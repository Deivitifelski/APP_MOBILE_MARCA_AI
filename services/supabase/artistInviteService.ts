import { supabase } from '../../lib/supabase';
import { createArtistInviteNotification } from '../notificationManager';
import { assertArtistTeamSlot } from './userService';

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

// Criar convite para colaborar (agora apenas na tabela notifications)
export const createArtistInvite = async (data: CreateInviteData): Promise<InviteResponse> => {
  try {
    const slot = await assertArtistTeamSlot(data.artistId, 'send_invite');
    if (slot.error) {
      return { success: false, error: slot.error };
    }
    if (!slot.ok) {
      return { success: false, error: slot.userMessage || 'Limite do plano gratuito atingido para este artista.' };
    }

    // Criar notificação diretamente na tabela notifications (tudo centralizado aqui)
    const { success, error, notification } = await createArtistInviteNotification(
      '', // Não precisa mais do inviteId
      data.toUserId,
      data.fromUserId,
      data.artistId,
      data.role || 'viewer' // ✅ Passar a role do convite
    );

    if (!success || !notification) {
      console.error('Erro ao criar convite (notificação):', error);
      return { success: false, error: error || 'Erro ao criar convite' };
    }

    // Retornar sucesso com a notificação criada
    return { 
      success: true, 
      invite: {
        id: notification.id,
        artist_id: data.artistId,
        from_user_id: data.fromUserId,
        to_user_id: data.toUserId,
        role: data.role || 'viewer',
        status: 'pending',
        read: false,
        created_at: notification.created_at,
        artist: notification.artist,
        from_user: notification.from_user
      } as ArtistInvite
    };
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

// Buscar convites enviados por um usuário (agora usando apenas a tabela notifications)
export const getArtistInvitesSent = async (userId: string): Promise<InviteResponse> => {
  try {
    // Buscar notificações do tipo 'invite' onde o usuário é o remetente
    const { data: notifications, error } = await supabase
      .from('notifications')
      .select(`
        id,
        artist_id,
        from_user_id,
        to_user_id,
        role,
        status,
        read,
        created_at,
        artist:artists(id, name)
      `)
      .eq('type', 'invite')
      .eq('from_user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erro ao buscar convites enviados:', error);
      return { success: false, error: error.message };
    }

    // Buscar dados dos usuários destinatários separadamente
    const toUserIds = [...new Set((notifications || []).map(n => n.to_user_id))];
    const { data: users } = await supabase
      .from('users')
      .select('id, name, email')
      .in('id', toUserIds);

    // Criar um mapa de usuários por ID
    const usersMap = new Map((users || []).map(u => [u.id, u]));

    // Converter notificações para o formato ArtistInvite
    const invites: ArtistInvite[] = (notifications || []).map(notification => {
      const toUser = usersMap.get(notification.to_user_id);
      return {
        id: notification.id,
        artist_id: notification.artist_id!,
        from_user_id: notification.from_user_id!,
        to_user_id: notification.to_user_id,
        role: notification.role || 'viewer',
        status: (notification.status === 'pending' ? 'pending' : 
                 notification.status === 'accepted' ? 'accepted' : 
                 notification.status === 'rejected' ? 'declined' : 'pending') as 'pending' | 'accepted' | 'declined',
        read: notification.read,
        created_at: notification.created_at,
        responded_at: undefined, // Campo não existe na tabela notifications
        artist: notification.artist,
        to_user: toUser ? {
          id: toUser.id,
          name: toUser.name,
          email: toUser.email
        } : undefined
      };
    });

    return { success: true, invites };
  } catch (error) {
    console.error('Erro ao buscar convites enviados:', error);
    return { success: false, error: 'Erro interno ao buscar convites' };
  }
};

// Aceitar convite (agora usando apenas a tabela notifications)
export const acceptArtistInvite = async (notificationId: string, userId: string): Promise<InviteResponse> => {
  try {
    console.log('🔄 Aceitando convite:', { notificationId, userId });
    
    // Buscar a notificação para obter os dados (artist_id e role)
    const { data: notification, error: fetchError } = await supabase
      .from('notifications')
      .select('id, artist_id, to_user_id, from_user_id, role, status')
      .eq('id', notificationId)
      .eq('to_user_id', userId)
      .eq('type', 'invite')
      .eq('status', 'pending')
      .single();

    if (fetchError || !notification) {
      console.error('❌ Notificação de convite não encontrada:', fetchError);
      return { success: false, error: 'Convite não encontrado ou já processado' };
    }

    console.log('✅ Notificação de convite encontrada:', notification);

    const slot = await assertArtistTeamSlot(notification.artist_id!, 'add_member');
    if (slot.error) {
      return { success: false, error: slot.error };
    }
    if (!slot.ok) {
      return { success: false, error: slot.userMessage || 'Este artista já atingiu o limite de colaboradores no plano gratuito.' };
    }

    // INSERIR DIRETAMENTE em artist_members com a role do convite
    const roleToUse = notification.role || 'viewer';
    console.log('🔐 Inserindo em artist_members com role:', roleToUse);

    const { error: insertError } = await supabase
      .from('artist_members')
      .insert({
        user_id: notification.to_user_id || userId,
        artist_id: notification.artist_id!,
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

    // O status da notificação será atualizado pela função updateNotificationStatus
    // chamada em handleAcceptInviteFromNotification

    return { success: true };
  } catch (error) {
    console.error('❌ Erro ao aceitar convite:', error);
    return { success: false, error: 'Erro interno ao aceitar convite' };
  }
};

// Recusar convite (agora usando apenas a tabela notifications)
export const declineArtistInvite = async (notificationId: string, userId: string): Promise<InviteResponse> => {
  try {
    console.log('🔄 Recusando convite:', { notificationId, userId });
    
    // Buscar a notificação para garantir que existe
    const { data: notification, error: fetchError } = await supabase
      .from('notifications')
      .select('id, artist_id, to_user_id, from_user_id, status')
      .eq('id', notificationId)
      .eq('to_user_id', userId)
      .eq('type', 'invite')
      .eq('status', 'pending')
      .single();

    if (fetchError || !notification) {
      console.error('❌ Notificação de convite não encontrada:', fetchError);
      return { success: false, error: 'Convite não encontrado ou já processado' };
    }

    console.log('✅ Notificação de convite encontrada:', notification);

    // O status da notificação será atualizado pela função updateNotificationStatus
    // chamada em handleDeclineInviteFromNotification (status = 'rejected')

    return { success: true };
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
// Cancelar convite (agora usando apenas a tabela notifications)
export const cancelArtistInvite = async (notificationId: string, fromUserId: string): Promise<InviteResponse> => {
  try {
    // Verificar se a notificação existe e é um convite pendente
    const { data: notification, error: fetchError } = await supabase
      .from('notifications')
      .select('id, from_user_id, type, status')
      .eq('id', notificationId)
      .eq('from_user_id', fromUserId)
      .eq('type', 'invite')
      .eq('status', 'pending')
      .single();

    if (fetchError || !notification) {
      console.error('Erro ao buscar notificação de convite:', fetchError);
      return { success: false, error: 'Convite não encontrado ou já foi processado' };
    }

    // Deletar a notificação (convite cancelado)
    const { error: deleteError } = await supabase
      .from('notifications')
      .delete()
      .eq('id', notificationId);

    if (deleteError) {
      console.error('Erro ao cancelar convite:', deleteError);
      return { success: false, error: deleteError.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Erro ao cancelar convite:', error);
    return { success: false, error: 'Erro interno ao cancelar convite' };
  }
};

// Verificar se já existe convite pendente (agora usando apenas a tabela notifications)
export const checkPendingInvite = async (artistId: string, toUserId: string): Promise<InviteResponse> => {
  try {
    console.log('🔍 checkPendingInvite: Buscando convite pendente', { artistId, toUserId });
    
    // Buscar TODAS as notificações do tipo invite para este artista e usuário
    const { data: notifications, error } = await supabase
      .from('notifications')
      .select('id, artist_id, from_user_id, to_user_id, role, status, read, created_at, type')
      .eq('artist_id', artistId)
      .eq('to_user_id', toUserId)
      .eq('type', 'invite');

    if (error) {
      console.error('❌ Erro ao buscar notificações:', error);
      return { success: false, error: error.message };
    }

    console.log('📋 Notificações encontradas:', notifications?.length || 0, notifications);

    // Filtrar apenas as que estão com status 'pending'
    const pendingNotification = (notifications || []).find(n => n.status === 'pending');

    if (!pendingNotification) {
      console.log('✅ Nenhum convite pendente encontrado');
      return { success: true, invite: null };
    }

    console.log('⚠️ Convite pendente encontrado:', pendingNotification);

    // Converter notificação para o formato ArtistInvite
    const invite: ArtistInvite = {
      id: pendingNotification.id,
      artist_id: pendingNotification.artist_id!,
      from_user_id: pendingNotification.from_user_id!,
      to_user_id: pendingNotification.to_user_id,
      role: pendingNotification.role || 'viewer',
      status: 'pending',
      read: pendingNotification.read,
      created_at: pendingNotification.created_at
    };

    return { success: true, invite };
  } catch (error) {
    console.error('❌ Erro ao verificar convite pendente:', error);
    return { success: false, error: 'Erro interno ao verificar convite' };
  }
};
