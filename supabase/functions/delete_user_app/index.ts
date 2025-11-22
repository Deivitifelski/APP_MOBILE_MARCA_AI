import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const supabaseAdmin = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        persistSession: false,
        detectSessionInUrl: false,
      },
    })
  : null;

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

serve(async (req) => {
  if (req.method !== 'POST') {
    return jsonResponse({ status: 'error', error: 'Método não permitido' }, 405);
  }

  if (!supabaseAdmin) {
    console.error('delete_user_account: variáveis globais do Supabase faltando');
    return jsonResponse({ status: 'error', error: 'Configuração do servidor inválida' }, 500);
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return jsonResponse({ status: 'error', error: 'Cabeçalho de autenticação ausente' }, 401);
    }

    const accessToken = authHeader.replace('Bearer ', '');
    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(accessToken);

    if (userError || !user) {
      return jsonResponse({ status: 'error', error: 'Usuário não autenticado' }, 401);
    }

    const { data: adminArtists, error: adminArtistsError } = await supabaseAdmin
      .from('artist_members')
      .select('artist_id')
      .eq('user_id', user.id)
      .eq('role', 'admin');

    if (adminArtistsError) {
      console.error('delete_user_account: erro ao buscar artista admin', adminArtistsError);
      return jsonResponse({ status: 'error', error: adminArtistsError.message }, 500);
    }

    let artistsDeleted = 0;
    let membershipsRemoved = 0;

    for (const artist of adminArtists || []) {
      const artistId = artist.artist_id;

      const { count, error: countError } = await supabaseAdmin
        .from('artist_members')
        .select('user_id', { count: 'exact', head: true })
        .eq('artist_id', artistId)
        .eq('role', 'admin');

      if (countError) {
        console.error('delete_user_account: erro ao contar admins', countError);
        return jsonResponse({ status: 'error', error: countError.message }, 500);
      }

      const adminCount = count ?? 0;

      if (adminCount <= 1) {
        const { data: deletedMembers, error: deleteMembersError } = await supabaseAdmin
          .from('artist_members')
          .delete()
          .eq('artist_id', artistId)
          .select();

        if (deleteMembersError) {
          console.error('delete_user_account: erro ao remover memberships do artista', deleteMembersError);
          return jsonResponse({ status: 'error', error: deleteMembersError.message }, 500);
        }

        membershipsRemoved += Array.isArray(deletedMembers) ? deletedMembers.length : 0;

        const { error: deleteArtistError } = await supabaseAdmin
          .from('artists')
          .delete()
          .eq('id', artistId);

        if (deleteArtistError) {
          console.error('delete_user_account: erro ao deletar artista', deleteArtistError);
          return jsonResponse({ status: 'error', error: deleteArtistError.message }, 500);
        }

        artistsDeleted += 1;
      } else {
        const { data: deletedPartial, error: deletePartialError } = await supabaseAdmin
          .from('artist_members')
          .delete()
          .eq('artist_id', artistId)
          .eq('user_id', user.id)
          .select();

        if (deletePartialError) {
          console.error('delete_user_account: erro ao remover membership do usuário', deletePartialError);
          return jsonResponse({ status: 'error', error: deletePartialError.message }, 500);
        }

        membershipsRemoved += Array.isArray(deletedPartial) ? deletedPartial.length : 0;
      }
    }

    const { data: remainingMemberships, error: remainingMembershipsError } = await supabaseAdmin
      .from('artist_members')
      .delete()
      .eq('user_id', user.id)
      .select();

    if (remainingMembershipsError) {
      console.error('delete_user_account: erro ao remover memberships restantes', remainingMembershipsError);
      return jsonResponse({ status: 'error', error: remainingMembershipsError.message }, 500);
    }

    membershipsRemoved += Array.isArray(remainingMemberships) ? remainingMemberships.length : 0;

    const cleanupSteps = [
      {
        name: 'notificações',
        query: supabaseAdmin
          .from('notifications')
          .delete()
          .or(`to_user_id.eq.${user.id},from_user_id.eq.${user.id}`)
          .select(),
      },
      {
        name: 'convites (artist_invites)',
        query: supabaseAdmin
          .from('artist_invites')
          .delete()
          .or(`to_user_id.eq.${user.id},from_user_id.eq.${user.id}`)
          .select(),
      },
      {
        name: 'eventos (events)',
        query: supabaseAdmin
          .from('events')
          .delete()
          .eq('user_id', user.id)
          .select(),
      },
      {
        name: 'feedbacks',
        query: supabaseAdmin
          .from('feedback_usuario')
          .delete()
          .eq('user_id', user.id)
          .select(),
      },
      {
        name: 'perfil público (users)',
        query: supabaseAdmin
          .from('users')
          .delete()
          .eq('id', user.id)
          .select(),
      },
    ];

    const cleanupResults: Record<string, unknown>[] = [];

    for (const step of cleanupSteps) {
      const { data, error } = await step.query;

      if (error) {
        const isMissingTable = error.message?.includes?.('Could not find the table');

        if (isMissingTable) {
          console.warn(`delete_user_account: tabela ausente (${step.name}), pulando`, error);
          cleanupResults.push({
            step: step.name,
            deleted: 'table_not_found',
            error: error.message,
          });
          continue;
        }

        console.error(`delete_user_account: erro ao limpar ${step.name}`, error);
        return jsonResponse(
          {
            status: 'error',
            error: `Erro ao limpar ${step.name}: ${error.message}`,
          },
          500
        );
      }

      cleanupResults.push({
        step: step.name,
        deleted: Array.isArray(data) ? data.length : null,
      });
    }

    const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(user.id);
    if (deleteUserError) {
      console.error('delete_user_account: erro ao deletar auth.users', deleteUserError);
      return jsonResponse(
        {
          status: 'error',
          error: deleteUserError.message,
        },
        500
      );
    }

    return jsonResponse({
      status: 'ok',
      message: 'Conta removida e dados relacionados apagados.',
      details: {
        artists_deleted: artistsDeleted,
        memberships_removed: membershipsRemoved,
        cleanup: cleanupResults,
      },
    });
  } catch (error) {
    console.error('delete_user_account: exceção inesperada', error);
    return jsonResponse({ status: 'error', error: (error as Error)?.message || 'Erro interno' }, 500);
  }
});

