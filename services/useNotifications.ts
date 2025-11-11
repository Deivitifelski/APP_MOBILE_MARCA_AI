import { useState, useEffect, useRef } from 'react';
import { getUnreadNotificationCount } from './supabase/notificationService';
import { getCurrentUser } from './supabase/authService';
import { subscribeToNotifications, subscribeToArtistInvites, RealtimeSubscription } from './realtimeService';

export const useNotifications = () => {
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const subscriptionsRef = useRef<RealtimeSubscription[]>([]);

  const loadUnreadCount = async () => {
    try {
      setIsLoading(true);
      
      const { user, error: userError } = await getCurrentUser();
      
      if (userError || !user) {
        setUnreadCount(0);
        return;
      }

      // Contar APENAS notificações não lidas (sem convites pendentes)
      const { count, error } = await getUnreadNotificationCount(user.id);
      
      if (error) {
        setUnreadCount(0);
      } else {
        setUnreadCount(count);
      }
    } catch (error) {
      setUnreadCount(0);
    } finally {
      setIsLoading(false);
    }
  };

  const updateUnreadCount = (newCount: number) => {
    setUnreadCount(newCount);
  };

  const setupRealtimeSubscriptions = async () => {
    try {
      const { user, error: userError } = await getCurrentUser();
      
      if (userError || !user) {
        return;
      }

      // Limpar subscriptions existentes
      subscriptionsRef.current.forEach(sub => sub.unsubscribe());
      subscriptionsRef.current = [];

      // Subscription para notificações
      const notificationSubscription = subscribeToNotifications(
        user.id,
        (notification) => {
          // Para notificações de eventos, recarregar contador total
          if (notification.type === 'event_created' || notification.type === 'event_updated') {
            loadUnreadCount();
          } else {
            // Para outras notificações, incrementar contador
            if (!notification.read) {
              setUnreadCount(prev => prev + 1);
            }
          }
        }
      );

      // Subscription para convites de artista
      const inviteSubscription = subscribeToArtistInvites(
        user.id,
        (invite) => {
          // Recarregar contador total quando houver mudanças nos convites
          loadUnreadCount();
        }
      );

      subscriptionsRef.current = [notificationSubscription, inviteSubscription];
      
    } catch (error) {
      // Erro ao configurar subscriptions em tempo real
    }
  };

  useEffect(() => {
    loadUnreadCount();
    setupRealtimeSubscriptions();

    // Cleanup ao desmontar
    return () => {
      subscriptionsRef.current.forEach(sub => sub.unsubscribe());
    };
  }, []);

  return {
    unreadCount,
    isLoading,
    loadUnreadCount,
    updateUnreadCount,
    setupRealtimeSubscriptions
  };
};
