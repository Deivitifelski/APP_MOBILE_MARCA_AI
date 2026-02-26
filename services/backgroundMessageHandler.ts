/**
 * Handler de mensagens FCM com app em background/fechado (Android).
 * Deve ser importado cedo (ex.: no _layout) para estar registrado quando uma mensagem chegar.
 * Atualiza o badge do ícone a partir de data.badge.
 */
import messaging from '@react-native-firebase/messaging';
import { Platform } from 'react-native';

if (Platform.OS === 'android') {
  try {
    messaging().setBackgroundMessageHandler(async (remoteMessage) => {
      try {
        const Notifications = await import('expo-notifications');
        const badgeStr = remoteMessage.data?.badge;
        let count = 0;
        if (badgeStr !== undefined && badgeStr !== null) {
          const n = parseInt(String(badgeStr), 10);
          if (!isNaN(n) && n >= 0) count = n;
        } else if (remoteMessage.notification || (remoteMessage.data && Object.keys(remoteMessage.data).length > 0)) {
          count = 1;
        }
        await Notifications.setBadgeCountAsync(count);
      } catch {
        // ignora falha ao atualizar badge
      }
    });
  } catch {
    // Firebase não disponível
  }
}
