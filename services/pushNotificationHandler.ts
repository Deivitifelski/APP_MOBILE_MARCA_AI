import messaging from '@react-native-firebase/messaging';
import { Platform, Alert } from 'react-native';

/**
 * Configura todos os handlers de notificações push para iOS e Android
 * 
 * IMPORTANTE: Este serviço deve ser inicializado no início do app
 * (no app/index.tsx ou _layout.tsx)
 */
export const setupPushNotificationHandlers = () => {
  console.log('🔔 Configurando handlers de notificações push...');

  // ============================================
  // 1. HANDLER PARA NOTIFICAÇÕES EM FOREGROUND
  // ============================================
  // Quando o app está aberto e uma notificação chega
  const unsubscribeForeground = messaging().onMessage(async remoteMessage => {
    console.log('📬 Notificação recebida em FOREGROUND:', remoteMessage);

    if (remoteMessage.notification) {
      const { title, body } = remoteMessage.notification;

      // No iOS, precisamos mostrar manualmente quando o app está em foreground
      if (Platform.OS === 'ios') {
        Alert.alert(
          title || 'Nova Notificação',
          body || 'Você tem uma nova notificação',
          [
            {
              text: 'Ver',
              onPress: () => {
                // Navegar para a tela de notificações se necessário
                console.log('Usuário clicou em "Ver"');
              },
            },
            {
              text: 'OK',
              style: 'cancel',
            },
          ]
        );
      } else {
        // Android mostra automaticamente, mas podemos customizar aqui
        console.log('Notificação em foreground (Android):', title, body);
      }
    }
  });

  // ============================================
  // 2. HANDLER PARA QUANDO APP É ABERTO VIA NOTIFICAÇÃO
  // ============================================
  // Quando o usuário toca na notificação e o app é aberto
  const unsubscribeNotificationOpened = messaging().onNotificationOpenedApp(
    remoteMessage => {
      console.log('📱 App aberto via notificação:', remoteMessage);

      if (remoteMessage.notification) {
        const { title, body, data } = remoteMessage.notification;
        console.log('Título:', title);
        console.log('Corpo:', body);
        console.log('Dados:', data);

        // Aqui você pode navegar para uma tela específica baseado nos dados
        // Por exemplo: router.push('/notificacoes');
      }
    }
  );

  // ============================================
  // 3. HANDLER PARA NOTIFICAÇÃO QUE ABRIU O APP
  // ============================================
  // Quando o app é aberto a partir de uma notificação (app estava fechado)
  messaging()
    .getInitialNotification()
    .then(remoteMessage => {
      if (remoteMessage) {
        console.log('🚀 App aberto a partir de notificação:', remoteMessage);

        if (remoteMessage.notification) {
          const { title, body, data } = remoteMessage.notification;
          console.log('Título:', title);
          console.log('Corpo:', body);
          console.log('Dados:', data);

          // Navegar para a tela apropriada
          // Por exemplo: router.push('/notificacoes');
        }
      }
    })
    .catch(error => {
      console.error('Erro ao verificar notificação inicial:', error);
    });

  // ============================================
  // 4. HANDLER PARA TOKEN ATUALIZADO
  // ============================================
  // Quando o token FCM é atualizado (pode acontecer periodicamente)
  const unsubscribeTokenRefresh = messaging().onTokenRefresh(token => {
    console.log('🔄 Token FCM atualizado:', token);
    // Aqui você deve salvar o novo token no banco de dados
    // Por exemplo: saveFCMToken(userId, token);
  });

  console.log('✅ Handlers de notificações push configurados!');

  // Retornar função para limpar os listeners (opcional)
  return () => {
    unsubscribeForeground();
    unsubscribeNotificationOpened();
    unsubscribeTokenRefresh();
  };
};

/**
 * Solicitar permissão de notificações (iOS)
 */
export const requestNotificationPermission = async (): Promise<boolean> => {
  if (Platform.OS !== 'ios') {
    // Android não precisa de permissão explícita
    return true;
  }

  try {
    const authStatus = await messaging().requestPermission();
    const enabled =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL;

    if (enabled) {
      console.log('✅ Permissão de notificação concedida:', authStatus);
      return true;
    } else {
      console.log('❌ Permissão de notificação negada:', authStatus);
      return false;
    }
  } catch (error) {
    console.error('Erro ao solicitar permissão:', error);
    return false;
  }
};

/**
 * Registrar dispositivo para mensagens remotas (iOS)
 */
export const registerDeviceForRemoteMessages = async (): Promise<boolean> => {
  if (Platform.OS !== 'ios') {
    return true;
  }

  try {
    await messaging().registerDeviceForRemoteMessages();
    console.log('✅ Dispositivo registrado para mensagens remotas');
    return true;
  } catch (error: any) {
    if (error?.code === 'messaging/device-already-registered') {
      console.log('✅ Dispositivo já estava registrado');
      return true;
    }
    console.error('Erro ao registrar dispositivo:', error);
    return false;
  }
};

/**
 * Obter token FCM atual
 */
export const getFCMToken = async (): Promise<string | null> => {
  try {
    const token = await messaging().getToken();
    console.log('🔑 Token FCM obtido:', token);
    return token;
  } catch (error) {
    console.error('Erro ao obter token FCM:', error);
    return null;
  }
};


