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
        console.error('❌ Erro ao carregar contador de notificações:', error);
        setUnreadCount(0);
      } else {
        console.log('🔔 [BADGE DEBUG] Notificações não lidas contadas:', count);
        console.log('🔔 [BADGE DEBUG] User ID:', user.id);
        setUnreadCount(count);
      }
    } catch (error) {
      console.error('❌ Erro ao carregar contador de notificações:', error);
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
          console.log('useNotifications: Nova notificação recebida:', notification);
          
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
          console.log('useNotifications: Mudança em convite de artista:', invite);
          
          // Recarregar contador total quando houver mudanças nos convites
          loadUnreadCount();
        }
      );

      subscriptionsRef.current = [notificationSubscription, inviteSubscription];
      
    } catch (error) {
      console.error('Erro ao configurar subscriptions em tempo real:', error);
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
