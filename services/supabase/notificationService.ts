import { supabase } from '../../lib/supabase';

export interface Notification {
  id: string;
  user_id: string;
  from_user_id?: string;
  artist_id?: string;
  event_id?: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  created_at: string;
  from_user?: {
    id: string;
    name: string;
    email: string;
    profile_url?: string;
  };
  artist?: {
    id: string;
    name: string;
  };
}

export interface CreateNotificationData {
  user_id: string;
  from_user_id?: string;
  artist_id?: string;
  event_id?: string;
  title: string;
  message: string;
  type: string;
}

// Criar notificação
export const createNotification = async (notificationData: CreateNotificationData): Promise<{ success: boolean; error: string | null; notification?: Notification }> => {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .insert({
        user_id: notificationData.user_id,
        from_user_id: notificationData.from_user_id || null,
        artist_id: notificationData.artist_id || null,
        event_id: notificationData.event_id || null,
        title: notificationData.title,
        message: notificationData.message,
        type: notificationData.type,
        read: false,
        created_at: new Date().toISOString()
      })
      .select(`
        *,
        from_user:users!from_user_id(id, name, email),
        artist:artists(id, name)
      `)
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, error: null, notification: data };
  } catch (error) {
    return { success: false, error: 'Erro de conexão' };
  }
};

// Buscar notificações do usuário (recebidas e enviadas)
export const getUserNotifications = async (userId: string, limit: number = 50): Promise<{ notifications: Notification[] | null; error: string | null }> => {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select(`
        *,
        from_user:users!from_user_id(id, name, email, profile_url),
        artist:artists(id, name)
      `)
      .or(`user_id.eq.${userId},from_user_id.eq.${userId}`)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      return { notifications: null, error: error.message };
    }

    // Filtrar notificações onde o usuário é o remetente (não mostrar notificações que o próprio usuário enviou)
    const filteredNotifications = (data || []).filter(notification => 
      notification.from_user_id !== userId
    );

    return { notifications: filteredNotifications, error: null };
  } catch (error) {
    return { notifications: null, error: 'Erro de conexão' };
  }
};

// Marcar notificação como lida
export const markNotificationAsRead = async (notificationId: string): Promise<{ success: boolean; error: string | null }> => {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, error: null };
  } catch (error) {
    return { success: false, error: 'Erro de conexão' };
  }
};

// Marcar todas as notificações como lidas
export const markAllNotificationsAsRead = async (userId: string): Promise<{ success: boolean; error: string | null }> => {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', userId)
      .eq('read', false);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, error: null };
  } catch (error) {
    return { success: false, error: 'Erro de conexão' };
  }
};

// Deletar notificação
export const deleteNotification = async (notificationId: string): Promise<{ success: boolean; error: string | null }> => {
  try {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', notificationId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, error: null };
  } catch (error) {
    return { success: false, error: 'Erro de conexão' };
  }
};

// Contar notificações não lidas (recebidas e enviadas)
export const getUnreadNotificationCount = async (userId: string): Promise<{ count: number; error: string | null }> => {
  try {
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .or(`user_id.eq.${userId},from_user_id.eq.${userId}`)
      .eq('read', false);

    if (error) {
      return { count: 0, error: error.message };
    }

    return { count: count || 0, error: null };
  } catch (error) {
    return { count: 0, error: 'Erro de conexão' };
  }
};

// Contar convites de artista pendentes
export const getPendingArtistInvitesCount = async (userId: string): Promise<{ count: number; error: string | null }> => {
  try {
    const { count, error } = await supabase
      .from('artist_invites')
      .select('*', { count: 'exact', head: true })
      .eq('to_user_id', userId)
      .eq('status', 'pending');

    if (error) {
      return { count: 0, error: error.message };
    }

    return { count: count || 0, error: null };
  } catch (error) {
    return { count: 0, error: 'Erro de conexão' };
  }
};

// Contar total de notificações não lidas (incluindo convites pendentes)
export const getTotalUnreadCount = async (userId: string): Promise<{ count: number; error: string | null }> => {
  try {
    // Buscar contagem de notificações
    const { count: notificationCount, error: notificationError } = await getUnreadNotificationCount(userId);
    
    if (notificationError) {
      return { count: 0, error: notificationError };
    }

    // Buscar contagem de convites pendentes
    const { count: inviteCount, error: inviteError } = await getPendingArtistInvitesCount(userId);
    
    if (inviteError) {
      return { count: notificationCount, error: inviteError };
    }

    const totalCount = notificationCount + inviteCount;
    return { count: totalCount, error: null };
  } catch (error) {
    return { count: 0, error: 'Erro de conexão' };
  }
};
