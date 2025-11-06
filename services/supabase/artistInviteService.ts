import { supabase } from '../../lib/supabase';
import { createArtistInviteNotification } from '../notificationManager';

export interface ArtistInvite {
  id: string;
  artist_id: string;
  from_user_id: string;
  to_user_id: string;
  role: 'viewer' | 'editor' | 'admin' | 'owner'; // Role que será atribuída ao aceitar
  status: 'pending' | 'accepted' | 'declined';
  read: boolean;
  created_at: string;
  responded_at?: string;
  artist?: {
    id: string;
    name: string;
  };
  from_user?: {
    id: string;
    name: string;
    email: string;
  };
  to_user?: {
    id: string;
    name: string;
    email: string;
  };
}

export interface CreateInviteData {
  artistId: string;
  toUserId: string;
  fromUserId: string;
  role?: 'viewer' | 'editor' | 'admin' | 'owner'; // Role a ser atribuída (padrão: viewer)
}

export interface InviteResponse {
  success: boolean;
  error?: string;
  invite?: ArtistInvite;
  invites?: ArtistInvite[];
}

// Criar convite para colaborar
export const createArtistInvite = async (data: CreateInviteData): Promise<InviteResponse> => {
  try {
    // Criar data no horário local do Brasil
    const now = new Date();
    const brazilTime = new Date(now.getTime() - (3 * 60 * 60 * 1000)); // Subtrai 3 horas para ajustar ao Brasil
    
    const { data: invite, error } = await supabase
      .from('artist_invites')
      .insert({
        artist_id: data.artistId,
        from_user_id: data.fromUserId,
        to_user_id: data.toUserId,
        role: data.role || 'viewer', // ✅ Salvar a role escolhida
        status: 'pending',
        read: false,
        created_at: brazilTime.toISOString()
      })
      .select(`
        *,
        artist:artists(id, name),
        from_user:users!artist_invites_from_user_id_fkey(id, name, email),
        to_user:users!artist_invites_to_user_id_fkey(id, name, email)
      `)
      .single();

    if (error) {
      console.error('Erro ao criar convite:', error);
      return { success: false, error: error.message };
    }

    // Criar notificação para o usuário convidado
    try {
      await createArtistInviteNotification(
        invite.id,
        data.toUserId,
        data.fromUserId,
        data.artistId,
        invite.role || data.role || 'viewer' // ✅ Passar a role do convite
      );
    } catch (notificationError) {
      console.error('Erro ao criar notificação de convite:', notificationError);
      // Não falhar o convite se a notificação falhar
    }

    return { success: true, invite };
  } catch (error) {
    console.error('Erro ao criar convite:', error);
    return { success: false, error: 'Erro interno ao criar convite' };
  }
};

// Buscar convites recebidos por um usuário
export const getArtistInvitesReceived = async (userId: string): Promise<InviteResponse> => {
  try {
    const { data: invites, error } = await supabase
      .from('artist_invites')
      .select(`
        *,
        artist:artists(id, name),
        from_user:users!artist_invites_from_user_id_fkey(id, name, email)
      `)
      .eq('to_user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erro ao buscar convites recebidos:', error);
      return { success: false, error: error.message };
    }

    return { success: true, invites: invites as ArtistInvite[] };
  } catch (error) {
    console.error('Erro ao buscar convites recebidos:', error);
    return { success: false, error: 'Erro interno ao buscar convites' };
  }
};

// Buscar convites enviados por um usuário
export const getArtistInvitesSent = async (userId: string): Promise<InviteResponse> => {
  try {
    const { data: invites, error } = await supabase
      .from('artist_invites')
      .select(`
        *,
        artist:artists(id, name),
        to_user:users!artist_invites_to_user_id_fkey(id, name, email)
      `)
      .eq('from_user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erro ao buscar convites enviados:', error);
      return { success: false, error: error.message };
    }

    return { success: true, invites: invites as ArtistInvite[] };
  } catch (error) {
    console.error('Erro ao buscar convites enviados:', error);
    return { success: false, error: 'Erro interno ao buscar convites' };
  }
};

// Aceitar convite
export const acceptArtistInvite = async (inviteId: string, userId: string): Promise<InviteResponse> => {
  try {
    console.log('🔄 Aceitando convite:', { inviteId, userId });
    
    // Buscar o convite para obter os dados (artist_id e role)
    const { data: invite, error: fetchError } = await supabase
      .from('artist_invites')
      .select('id, artist_id, to_user_id, from_user_id, role, status')
      .eq('id', inviteId)
      .eq('to_user_id', userId)
      .eq('status', 'pending')
      .single();

    if (fetchError || !invite) {
      console.error('❌ Convite não encontrado:', fetchError);
      return { success: false, error: 'Convite não encontrado ou já processado' };
    }

    console.log('✅ Convite encontrado:', invite);

    // INSERIR DIRETAMENTE em artist_members com a role do convite
    const roleToUse = invite.role || 'viewer';
    console.log('🔐 Inserindo em artist_members com role:', roleToUse);

    const { error: insertError } = await supabase
      .from('artist_members')
      .insert({
        user_id: invite.to_user_id,
        artist_id: invite.artist_id,
        role: roleToUse, // ✅ Role do convite
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

    if (insertError) {
      // Verificar se o erro é porque o usuário já é membro
      if (insertError.code === '23505') { // Unique violation
        console.error('❌ Usuário já é membro deste artista');
        return { success: false, error: 'Você já é membro deste artista' };
      }
      
      console.error('❌ Erro ao inserir em artist_members:', insertError);
      return { success: false, error: insertError.message };
    }

    console.log('✅ Colaborador adicionado com role:', roleToUse);

    // Marcar convite como aceito (opcional - para histórico)
    const now = new Date();
    const brazilTime = new Date(now.getTime() - (3 * 60 * 60 * 1000));
    
    await supabase
      .from('artist_invites')
      .update({
        status: 'accepted',
        responded_at: brazilTime.toISOString()
      })
      .eq('id', inviteId);

    console.log('✅ Convite marcado como aceito');

    return { success: true };
  } catch (error) {
    console.error('❌ Erro ao aceitar convite:', error);
    return { success: false, error: 'Erro interno ao aceitar convite' };
  }
};

// Recusar convite
export const declineArtistInvite = async (inviteId: string, userId: string): Promise<InviteResponse> => {
  try {
    const now = new Date();
    const brazilTime = new Date(now.getTime() - (3 * 60 * 60 * 1000)); // Subtrai 3 horas para ajustar ao Brasil
    
    const { data: invite, error } = await supabase
      .from('artist_invites')
      .update({
        status: 'declined',
        responded_at: brazilTime.toISOString()
      })
      .eq('id', inviteId)
      .eq('to_user_id', userId)
      .eq('status', 'pending')
      .select(`
        *,
        artist:artists(id, name),
        from_user:users!artist_invites_from_user_id_fkey(id, name, email),
        to_user:users!artist_invites_to_user_id_fkey(id, name, email)
      `)
      .single();

    if (error) {
      console.error('Erro ao recusar convite:', error);
      return { success: false, error: error.message };
    }

    if (!invite) {
      return { success: false, error: 'Convite não encontrado ou já processado' };
    }

    // Deletar notificação relacionada ao convite recusado
    try {
      const { deleteNotification } = await import('./notificationService');
      // Buscar e deletar notificações relacionadas ao convite
      const { data: notifications } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', userId)
        .eq('type', 'artist_invite')
        .eq('artist_id', invite.artist_id)
        .eq('from_user_id', invite.from_user_id);

      if (notifications && notifications.length > 0) {
        for (const notification of notifications) {
          await deleteNotification(notification.id);
        }
      }
    } catch (notificationError) {
      console.error('Erro ao deletar notificação do convite recusado:', notificationError);
      // Não falhar o processo se a notificação não for deletada
    }

    return { success: true, invite };
  } catch (error) {
    console.error('Erro ao recusar convite:', error);
    return { success: false, error: 'Erro interno ao recusar convite' };
  }
};

// Marcar convite como lido
export const markInviteAsRead = async (inviteId: string, userId: string): Promise<InviteResponse> => {
  try {
    const { data: invite, error } = await supabase
      .from('artist_invites')
      .update({ read: true })
      .eq('id', inviteId)
      .eq('to_user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('Erro ao marcar convite como lido:', error);
      return { success: false, error: error.message };
    }

    return { success: true, invite };
  } catch (error) {
    console.error('Erro ao marcar convite como lido:', error);
    return { success: false, error: 'Erro interno ao marcar convite como lido' };
  }
};

// Cancelar convite (apenas o remetente pode cancelar)
export const cancelArtistInvite = async (inviteId: string, fromUserId: string): Promise<InviteResponse> => {
  try {
    const { data: invite, error } = await supabase
      .from('artist_invites')
      .delete()
      .eq('id', inviteId)
      .eq('from_user_id', fromUserId)
      .eq('status', 'pending')
      .select()
      .single();

    if (error) {
      console.error('Erro ao cancelar convite:', error);
      return { success: false, error: error.message };
    }

    return { success: true, invite };
  } catch (error) {
    console.error('Erro ao cancelar convite:', error);
    return { success: false, error: 'Erro interno ao cancelar convite' };
  }
};

// Verificar se já existe convite pendente
export const checkPendingInvite = async (artistId: string, toUserId: string): Promise<InviteResponse> => {
  try {
    const { data: invite, error } = await supabase
      .from('artist_invites')
      .select('*')
      .eq('artist_id', artistId)
      .eq('to_user_id', toUserId)
      .eq('status', 'pending')
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Erro ao verificar convite pendente:', error);
      return { success: false, error: error.message };
    }

    return { success: true, invite: invite || null };
  } catch (error) {
    console.error('Erro ao verificar convite pendente:', error);
    return { success: false, error: 'Erro interno ao verificar convite' };
  }
};
