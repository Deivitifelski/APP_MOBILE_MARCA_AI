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
        const badgeStr = remoteMessage.data?.badge;
        if (badgeStr !== undefined && badgeStr !== null) {
          const count = parseInt(String(badgeStr), 10);
          if (!isNaN(count) && count >= 0) {
            const Notifications = await import('expo-notifications');
            await Notifications.setBadgeCountAsync(count);
          }
        }
      } catch {
        // ignora falha ao atualizar badge
      }
    });
  } catch {
    // Firebase não disponível
  }
}
