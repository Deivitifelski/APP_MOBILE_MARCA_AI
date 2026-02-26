/**
 * Handler de mensagens FCM com app em background/fechado (Android).
 * Deve ser importado cedo (ex.: no _layout) para estar registrado quando uma mensagem chegar.
 * A cada notificação: incrementa o contador no ícone do app (badge).
 * Se o payload enviar data.badge (número), usa esse valor como total; senão incrementa +1.
 */
import messaging from '@react-native-firebase/messaging';
import { Platform } from 'react-native';

if (Platform.OS === 'android') {
  try {
    messaging().setBackgroundMessageHandler(async (remoteMessage) => {
      try {
        const Notifications = await import('expo-notifications');
        const badgeStr = remoteMessage.data?.badge;
        let newCount: number;

        if (badgeStr !== undefined && badgeStr !== null) {
          const n = parseInt(String(badgeStr), 10);
          if (!isNaN(n) && n >= 0) {
            newCount = n;
          } else {
            const current = await Notifications.getBadgeCountAsync();
            newCount = current + 1;
          }
        } else if (remoteMessage.notification || (remoteMessage.data && Object.keys(remoteMessage.data).length > 0)) {
          const current = await Notifications.getBadgeCountAsync();
          newCount = current + 1;
        } else {
          return;
        }
        await Notifications.setBadgeCountAsync(newCount);
      } catch {
        // ignora falha ao atualizar badge
      }
    });
  } catch {
    // Firebase não disponível
  }
}
