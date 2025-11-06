import { supabase } from '../../lib/supabase';

export interface Artist {
  id: string;
  name: string;
  profile_url?: string;
  role?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateArtistData {
  name: string;
  profile_url?: string;
  user_id: string;
}

// Criar perfil do artista
export const createArtist = async (artistData: CreateArtistData): Promise<{ success: boolean; error: string | null; artist?: Artist }> => {
  try {
    // Primeiro, criar o artista
    const { data: artistData_result, error: artistError } = await supabase
      .from('artists')
      .insert({
        name: artistData.name,
        profile_url: artistData.profile_url || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (artistError) {
      return { success: false, error: artistError.message };
    }

    // Depois, criar o relacionamento na tabela artist_members como owner
    const { error: memberError } = await supabase
      .from('artist_members')
      .insert({
        user_id: artistData.user_id,
        artist_id: artistData_result.id,
        role: 'owner',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

    if (memberError) {
      // Se der erro no relacionamento, deletar o artista criado
      await supabase.from('artists').delete().eq('id', artistData_result.id);
      return { success: false, error: memberError.message };
    }

    return { success: true, error: null, artist: artistData_result };
  } catch (error) {
    return { success: false, error: 'Erro de conexão' };
  }
};

// Buscar artistas do usuário atual
export const getArtists = async (userId: string): Promise<{ artists: Artist[] | null; error: string | null }> => {
  try {
    console.log('🔍 getArtists: Buscando artistas para usuário:', userId);
    
    // Primeiro, buscar os membros do usuário
    const { data: membersData, error: membersError } = await supabase
      .from('artist_members')
      .select('artist_id, role')
      .eq('user_id', userId);

    if (membersError) {
      console.error('❌ getArtists: Erro ao buscar membros:', membersError);
      return { artists: null, error: membersError.message };
    }

    console.log('📋 getArtists: Membros encontrados:', membersData?.length || 0);

    if (!membersData || membersData.length === 0) {
      console.log('❌ getArtists: Usuário não é membro de nenhum artista');
      return { artists: [], error: null };
    }

    // Buscar os artistas usando os IDs dos membros
    const artistIds = membersData.map(member => member.artist_id);
    const { data: artistsData, error: artistsError } = await supabase
      .from('artists')
      .select('id, name, profile_url, created_at, updated_at')
      .in('id', artistIds);

    if (artistsError) {
      console.error('❌ getArtists: Erro ao buscar artistas:', artistsError);
      return { artists: null, error: artistsError.message };
    }

    console.log('🎭 getArtists: Artistas encontrados:', artistsData?.length || 0);

    // Combinar os dados
    const artists = artistsData?.map(artist => {
      const member = membersData.find(m => m.artist_id === artist.id);
      return {
        id: artist.id,
        name: artist.name,
        profile_url: artist.profile_url,
        role: member?.role || 'viewer',
        created_at: artist.created_at,
        updated_at: artist.updated_at
      };
    }) || [];

    console.log('✅ getArtists: Artistas finais:', artists);
    return { artists, error: null };
  } catch (error) {
    console.error('❌ getArtists: Erro inesperado:', error);
    return { artists: null, error: 'Erro de conexão' };
  }
};

// Buscar artista por ID
export const getArtistById = async (artistId: string): Promise<{ artist: Artist | null; error: string | null }> => {
  try {
    const { data, error } = await supabase
      .from('artists')
      .select('*')
      .eq('id', artistId)
      .single();

    if (error) {
      return { artist: null, error: error.message };
    }

    return { artist: data, error: null };
  } catch (error) {
    return { artist: null, error: 'Erro de conexão' };
  }
};

// Atualizar artista
export const updateArtist = async (artistId: string, artistData: Partial<CreateArtistData>): Promise<{ success: boolean; error: string | null }> => {
  try {
    const { error } = await supabase
      .from('artists')
      .update({
        ...artistData,
        updated_at: new Date().toISOString()
      })
      .eq('id', artistId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, error: null };
  } catch (error) {
    return { success: false, error: 'Erro de conexão' };
  }
};

// Deletar artista (com todos os dados relacionados)
export const deleteArtist = async (artistId: string): Promise<{ success: boolean; error: string | null }> => {
  try {
    console.log('🗑️ Iniciando deleção do artista:', artistId);

    // 1️⃣ Deletar despesas dos eventos do artista
    console.log('🗑️ Deletando despesas dos eventos...');
    const { data: events } = await supabase
      .from('events')
      .select('id')
      .eq('artist_id', artistId);

    if (events && events.length > 0) {
      const eventIds = events.map(e => e.id);
      const { error: expensesError } = await supabase
        .from('event_expenses')
        .delete()
        .in('event_id', eventIds);

      if (expensesError) {
        console.error('❌ Erro ao deletar despesas:', expensesError);
        return { success: false, error: 'Erro ao deletar despesas dos eventos: ' + expensesError.message };
      }
      console.log('✅ Despesas deletadas');
    }

    // 2️⃣ Deletar eventos do artista
    console.log('🗑️ Deletando eventos...');
    const { error: eventsError } = await supabase
      .from('events')
      .delete()
      .eq('artist_id', artistId);

    if (eventsError) {
      console.error('❌ Erro ao deletar eventos:', eventsError);
      return { success: false, error: 'Erro ao deletar eventos: ' + eventsError.message };
    }
    console.log('✅ Eventos deletados');

    // 3️⃣ Deletar convites pendentes do artista
    console.log('🗑️ Deletando convites...');
    const { error: invitesError } = await supabase
      .from('artist_invites')
      .delete()
      .eq('artist_id', artistId);

    if (invitesError) {
      console.error('❌ Erro ao deletar convites:', invitesError);
      // Não retornar erro, continuar a deleção
    } else {
      console.log('✅ Convites deletados');
    }

    // 4️⃣ Deletar colaboradores (artist_members)
    console.log('🗑️ Deletando colaboradores...');
    const { error: membersError } = await supabase
      .from('artist_members')
      .delete()
      .eq('artist_id', artistId);

    if (membersError) {
      console.error('❌ Erro ao deletar colaboradores:', membersError);
      return { success: false, error: 'Erro ao deletar colaboradores: ' + membersError.message };
    }
    console.log('✅ Colaboradores deletados');

    // 5️⃣ Deletar notificações relacionadas ao artista
    console.log('🗑️ Deletando notificações...');
    const { error: notificationsError } = await supabase
      .from('notifications')
      .delete()
      .eq('artist_id', artistId);

    if (notificationsError) {
      console.error('❌ Erro ao deletar notificações:', notificationsError);
      // Não retornar erro, continuar a deleção
    } else {
      console.log('✅ Notificações deletadas');
    }

    // 6️⃣ Finalmente, deletar o artista
    console.log('🗑️ Deletando artista...');
    const { error: artistError } = await supabase
      .from('artists')
      .delete()
      .eq('id', artistId);

    if (artistError) {
      console.error('❌ Erro ao deletar artista:', artistError);
      return { success: false, error: 'Erro ao deletar artista: ' + artistError.message };
    }

    console.log('✅ Artista deletado com sucesso!');
    return { success: true, error: null };

  } catch (error) {
    console.error('❌ Erro geral ao deletar artista:', error);
    return { success: false, error: 'Erro de conexão ao deletar artista' };
  }
};
