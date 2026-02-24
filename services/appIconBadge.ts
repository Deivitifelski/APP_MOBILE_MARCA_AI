import { Platform } from 'react-native';

/**
 * Atualiza o badge do ícone do app (home). Zerar ao abrir: setAppIconBadge(0).
 * iOS: PushNotificationIOS (nativo). Android: expo-notifications (só importa no Android, evita crash no iOS).
 */
export const setAppIconBadge = async (count: number): Promise<void> => {
  if (Platform.OS === 'ios') {
    try {
      const PushNotificationIOS = require('@react-native-community/push-notification-ios').default;
      PushNotificationIOS.setApplicationIconBadgeNumber(count);
    } catch {
      // pacote não instalado ou não linkado
    }
    return;
  }
  if (Platform.OS === 'android') {
    try {
      const Notifications = await import('expo-notifications');
      await Notifications.setBadgeCountAsync(count);
    } catch {
      // expo-notifications não linkado ou launcher não suporta badge
    }
  }
};

/**
 * Sincroniza o badge com a contagem do servidor (foreground). Opcional.
 */
export const syncAppIconBadgeWithServer = async (): Promise<void> => {
  try {
    const { getCurrentUser } = await import('./supabase/authService');
    const { getUnreadNotificationCount } = await import('./supabase/notificationService');
    const { user, error: userError } = await getCurrentUser();
    if (userError || !user) {
      await setAppIconBadge(0);
      return;
    }
    const { count, error } = await getUnreadNotificationCount(user.id);
    await setAppIconBadge(error ? 0 : count);
  } catch {
    await setAppIconBadge(0);
  }
};
