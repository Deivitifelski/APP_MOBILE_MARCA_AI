import { Platform } from 'react-native';

/**
 * Atualiza o badge do ícone do app (home). Zerar ao abrir: setAppIconBadge(0).
 * iOS: usa PushNotificationIOS (nativo). Android: no-op (badge não é padrão).
 */
export const setAppIconBadge = async (count: number): Promise<void> => {
  if (Platform.OS === 'ios') {
    try {
      const PushNotificationIOS = require('@react-native-community/push-notification-ios').default;
      PushNotificationIOS.setApplicationIconBadgeNumber(count);
    } catch {
      // pacote não instalado ou não linkado
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
