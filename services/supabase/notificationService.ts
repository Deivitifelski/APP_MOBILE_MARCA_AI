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
  role?: 'viewer' | 'editor' | 'admin' | 'owner'; // Role para convites
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
        role: notificationData.role || null, // ✅ Salvar role da notificação
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
      .eq('user_id', userId) // Apenas notificações que o usuário RECEBEU
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

// Marcar todas as notificações como lidas
export const markAllNotificationsAsRead = async (userId: string): Promise<{ success: boolean; error: string | null }> => {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', userId)
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
    // Buscar todas as notificações não lidas
    const { data: allNotifications, error: notifError } = await supabase
      .from('notifications')
      .select('id, type, read, user_id, created_at, artist_id')
      .eq('user_id', userId)
      .eq('read', false);

    if (notifError) {
      console.error('❌ [BADGE DEBUG] Erro ao buscar notificações:', notifError);
      return { count: 0, error: notifError.message };
    }

    console.log('🔍 [BADGE DEBUG] Total de notificações não lidas no banco:', allNotifications?.length || 0);

    // Filtrar notificações de convites para verificar se o convite ainda está pendente
    let validNotifications = [];
    
    for (const notification of (allNotifications || [])) {
      console.log(`   📬 Analisando: Tipo=${notification.type}, ID=${notification.id.substring(0, 8)}`);
      
      if (notification.type === 'artist_invite' && notification.artist_id) {
        // Verificar se o convite ainda está pendente
        const { data: invites, error: inviteError } = await supabase
          .from('artist_invites')
          .select('status')
          .eq('to_user_id', userId)
          .eq('artist_id', notification.artist_id)
          .eq('status', 'pending')
          .limit(1);

        if (!inviteError && invites && invites.length > 0) {
          console.log(`      ✅ Convite ainda pendente - CONTAR`);
          validNotifications.push(notification);
        } else {
          console.log(`      ❌ Convite já processado - NÃO CONTAR (deve ser marcado como lido)`);
        }
      } else {
        // Outras notificações sempre contam
        console.log(`      ✅ Notificação válida - CONTAR`);
        validNotifications.push(notification);
      }
    }

    const finalCount = validNotifications.length;
    console.log('🔔 [BADGE DEBUG] Contagem final válida:', finalCount);

    return { count: finalCount, error: null };
  } catch (error) {
    console.error('❌ [BADGE DEBUG] Erro de conexão:', error);
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
