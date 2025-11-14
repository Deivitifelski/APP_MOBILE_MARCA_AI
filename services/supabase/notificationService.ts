import { supabase } from '../../lib/supabase';

export interface Notification {
  id: string;
  user_id: string;
  from_user_id?: string;
  artist_id?: string;
  event_id?: string;
  role?: 'viewer' | 'editor' | 'admin' | 'owner'; // Role para convites de artista
  title: string;
  message: string;
  type: string;
  read: boolean;
  status?: 'pending' | 'accepted' | 'rejected'; // Status para convites
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
  to_user_id: string; // Campo renomeado para to_user_id (destinatário da notificação)
  from_user_id?: string;
  artist_id?: string;
  event_id?: string;
  role?: 'viewer' | 'editor' | 'admin' | 'owner'; // Role para convites
  title: string;
  message: string;
  type: string;
  status?: 'pending' | 'accepted' | 'rejected'; // Status para convites
}

// Criar notificação
export const createNotification = async (notificationData: CreateNotificationData): Promise<{ success: boolean; error: string | null; notification?: Notification }> => {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .insert({
        to_user_id: notificationData.to_user_id,
        from_user_id: notificationData.from_user_id || null,
        artist_id: notificationData.artist_id || null,
        event_id: notificationData.event_id || null,
        role: notificationData.role || null, // ✅ Salvar role da notificação
        title: notificationData.title,
        message: notificationData.message,
        type: notificationData.type,
        status: notificationData.status || null, // ✅ Salvar status (pending, accepted, rejected)
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
      .eq('to_user_id', userId) // Apenas notificações que o usuário RECEBEU
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      return { notifications: null, error: error.message };
    }

    return { notifications: data || [], error: null };
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

// Atualizar status e read de uma notificação (para convites)
export const updateNotificationStatus = async (
  notificationId: string, 
  status: 'accepted' | 'rejected'
): Promise<{ success: boolean; error: string | null }> => {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ 
        read: true,
        status: status
      })
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
    const { data, error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('to_user_id', userId)
      .eq('read', false)
      .select();

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

// Contar notificações não lidas (apenas RECEBIDAS)
export const getUnreadNotificationCount = async (userId: string): Promise<{ count: number; error: string | null }> => {
  try {
    const { count, error } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('to_user_id', userId)
      .eq('read', false);

    if (error) {
      return { count: 0, error: error.message };
    }

    return { count: count ?? 0, error: null };
  } catch (error) {
    return { count: 0, error: 'Erro de conexão' };
  }
};

// Contar total de notificações não lidas (centralizado na tabela notifications)
// Esta função é um alias para getUnreadNotificationCount para manter compatibilidade
export const getTotalUnreadCount = async (userId: string): Promise<{ count: number; error: string | null }> => {
  // Tudo está centralizado na tabela notifications agora
  return await getUnreadNotificationCount(userId);
};
