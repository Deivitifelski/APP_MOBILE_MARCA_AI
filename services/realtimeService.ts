import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export interface RealtimeSubscription {
  channel: RealtimeChannel;
  unsubscribe: () => void;
}

export interface NotificationPayload {
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
  };
  artist?: {
    id: string;
    name: string;
  };
}

export interface ArtistInvitePayload {
  id: string;
  artist_id: string;
  to_user_id: string;
  from_user_id: string;
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
  created_at: string;
  updated_at: string;
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

// Escutar notificações em tempo real (recebidas e enviadas)
export const subscribeToNotifications = (
  userId: string,
  onNotificationChange: (payload: NotificationPayload) => void
): RealtimeSubscription => {
  console.log('realtimeService: Criando subscription para notificações do usuário:', userId);

  const channel = supabase
    .channel(`notifications:${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*', // INSERT, UPDATE, DELETE
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        console.log('realtimeService: Mudança detectada em notifications (recebidas):', payload);
        
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const notification = payload.new as NotificationPayload;
          onNotificationChange(notification);
        }
      }
    )
    .on(
      'postgres_changes',
      {
        event: '*', // INSERT, UPDATE, DELETE
        schema: 'public',
        table: 'notifications',
        filter: `from_user_id=eq.${userId}`,
      },
      (payload) => {
        console.log('realtimeService: Mudança detectada em notifications (enviadas):', payload);
        
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const notification = payload.new as NotificationPayload;
          onNotificationChange(notification);
        }
      }
    )
    .subscribe((status) => {
      console.log('realtimeService: Status da subscription de notifications:', status);
    });

  return {
    channel,
    unsubscribe: () => {
      console.log('realtimeService: Removendo subscription de notifications');
      supabase.removeChannel(channel);
    }
  };
};

// Escutar convites de artista em tempo real
export const subscribeToArtistInvites = (
  userId: string,
  onInviteChange: (payload: ArtistInvitePayload) => void
): RealtimeSubscription => {
  console.log('realtimeService: Criando subscription para convites de artista do usuário:', userId);

  const channel = supabase
    .channel(`artist_invites:${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*', // INSERT, UPDATE, DELETE
        schema: 'public',
        table: 'artist_invites',
        filter: `to_user_id=eq.${userId}`,
      },
      (payload) => {
        console.log('realtimeService: Mudança detectada em artist_invites (recebidos):', payload);
        
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const invite = payload.new as ArtistInvitePayload;
          onInviteChange(invite);
        }
      }
    )
    .on(
      'postgres_changes',
      {
        event: '*', // INSERT, UPDATE, DELETE
        schema: 'public',
        table: 'artist_invites',
        filter: `from_user_id=eq.${userId}`,
      },
      (payload) => {
        console.log('realtimeService: Mudança detectada em artist_invites (enviados):', payload);
        
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const invite = payload.new as ArtistInvitePayload;
          onInviteChange(invite);
        }
      }
    )
    .subscribe((status) => {
      console.log('realtimeService: Status da subscription de artist_invites:', status);
    });

  return {
    channel,
    unsubscribe: () => {
      console.log('realtimeService: Removendo subscription de artist_invites');
      supabase.removeChannel(channel);
    }
  };
};

// Escutar mudanças em artist_members (para colaboradores)
export const subscribeToArtistMembers = (
  userId: string,
  onMemberChange: (payload: any) => void
): RealtimeSubscription => {
  console.log('realtimeService: Criando subscription para artist_members do usuário:', userId);

  const channel = supabase
    .channel(`artist_members:${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'artist_members',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        console.log('realtimeService: Mudança detectada em artist_members:', payload);
        
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE' || payload.eventType === 'DELETE') {
          onMemberChange(payload);
        }
      }
    )
    .subscribe((status) => {
      console.log('realtimeService: Status da subscription de artist_members:', status);
    });

  return {
    channel,
    unsubscribe: () => {
      console.log('realtimeService: Removendo subscription de artist_members');
      supabase.removeChannel(channel);
    }
  };
};

// Escutar mudanças na tabela users
export const subscribeToUsers = (
  userId: string,
  onUserChange: (payload: any) => void
): RealtimeSubscription => {
  console.log('realtimeService: Criando subscription para users do usuário:', userId);

  const channel = supabase
    .channel(`users:${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*', // INSERT, UPDATE, DELETE
        schema: 'public',
        table: 'users',
        filter: `id=eq.${userId}`,
      },
      (payload) => {
        console.log('realtimeService: Mudança detectada em users:', payload);
        
        if (payload.eventType === 'UPDATE') {
          onUserChange(payload);
        }
      }
    )
    .subscribe((status) => {
      console.log('realtimeService: Status da subscription de users:', status);
    });

  return {
    channel,
    unsubscribe: () => {
      console.log('realtimeService: Removendo subscription de users');
      supabase.removeChannel(channel);
    }
  };
};

// Escutar mudanças na tabela artists
export const subscribeToArtists = (
  artistId: string,
  onArtistChange: (payload: any) => void
): RealtimeSubscription => {
  console.log('realtimeService: Criando subscription para artists:', artistId);

  const channel = supabase
    .channel(`artists:${artistId}`)
    .on(
      'postgres_changes',
      {
        event: '*', // INSERT, UPDATE, DELETE
        schema: 'public',
        table: 'artists',
        filter: `id=eq.${artistId}`,
      },
      (payload) => {
        console.log('🎨 Mudança detectada no artista:', payload);
        
        if (payload.eventType === 'UPDATE') {
          onArtistChange(payload);
        }
      }
    )
    .subscribe((status) => {
      console.log('realtimeService: Status da subscription de artists:', status);
    });

  return {
    channel,
    unsubscribe: () => {
      console.log('realtimeService: Removendo subscription de artists');
      supabase.removeChannel(channel);
    }
  };
};

// Função para limpar todas as subscriptions
export const cleanupSubscriptions = (subscriptions: RealtimeSubscription[]) => {
  console.log('realtimeService: Limpando todas as subscriptions');
  subscriptions.forEach(subscription => {
    subscription.unsubscribe();
  });
};
