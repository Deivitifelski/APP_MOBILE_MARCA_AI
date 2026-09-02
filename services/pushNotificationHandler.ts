import messaging from "@react-native-firebase/messaging";
import { Platform } from "react-native";

/**
 * Configura todos os handlers de notificações push para iOS e Android
 *
 * IMPORTANTE: Este serviço deve ser inicializado no início do app
 * (no app/index.tsx ou _layout.tsx)
 */
export const setupPushNotificationHandlers = () => {
  console.log("🔔 Configurando handlers de notificações push...");

  // Verificar se o Firebase está disponível
  // Se não estiver, os handlers simplesmente não funcionarão, mas não causarão crash
  let firebaseAvailable = true;
  try {
    // Tentar acessar o messaging - se Firebase não estiver configurado, isso pode falhar
    const messagingInstance = messaging();
    if (!messagingInstance) {
      firebaseAvailable = false;
    }
  } catch (error) {
    firebaseAvailable = false;
    console.warn(
      "⚠️ Firebase não está configurado. Notificações push não estarão disponíveis.",
    );
    console.warn(
      "💡 Para habilitar: Adicione o GoogleService-Info.plist ao projeto iOS.",
    );
    // Retornar função vazia de cleanup
    return () => {};
  }

  if (!firebaseAvailable) {
    return () => {};
  }

  // ============================================
  // 1. HANDLER PARA NOTIFICAÇÕES EM FOREGROUND
  // ============================================
  // Quando o app está aberto e uma notificação chega
  const unsubscribeForeground = messaging().onMessage(async (remoteMessage) => {
    console.log("📬 Notificação recebida em FOREGROUND:", remoteMessage);
    const title = remoteMessage.notification?.title;
    const body = remoteMessage.notification?.body;
    const data = remoteMessage.data ?? {};

    if (title || body) {
      console.log("Foreground:", title, body, data);
    }

    try {
      const { setAppIconBadge } = await import("./appIconBadge");
      await setAppIconBadge(0);
    } catch {
      // ignora se falhar
    }
  });

  // ============================================
  // 2. HANDLER PARA QUANDO APP É ABERTO VIA NOTIFICAÇÃO
  // ============================================
  // Quando o usuário toca na notificação e o app é aberto
  const unsubscribeNotificationOpened = messaging().onNotificationOpenedApp(
    (remoteMessage) => {
      console.log("📱 App aberto via notificação:", remoteMessage);

      const title = remoteMessage.notification?.title;
      const body = remoteMessage.notification?.body;
      const data = remoteMessage.data ?? {};

      if (title || body || Object.keys(data).length > 0) {
        console.log("Título:", title);
        console.log("Corpo:", body);
        console.log("Dados:", data);
      }
    },
  );

  // ============================================
  // 3. HANDLER PARA NOTIFICAÇÃO QUE ABRIU O APP
  // ============================================
  // Quando o app é aberto a partir de uma notificação (app estava fechado)
  messaging()
    .getInitialNotification()
    .then((remoteMessage) => {
      if (remoteMessage) {
        console.log("🚀 App aberto a partir de notificação:", remoteMessage);

        const title = remoteMessage.notification?.title;
        const body = remoteMessage.notification?.body;
        const data = remoteMessage.data ?? {};

        if (title || body || Object.keys(data).length > 0) {
          console.log("Título:", title);
          console.log("Corpo:", body);
          console.log("Dados:", data);
        }
      }
    })
    .catch((error) => {
      console.error("Erro ao verificar notificação inicial:", error);
    });

  // ============================================
  // 4. HANDLER PARA TOKEN ATUALIZADO
  // ============================================
  // Quando o token FCM é atualizado (pode acontecer periodicamente)
  const unsubscribeTokenRefresh = messaging().onTokenRefresh(async (token) => {
    console.log("🔄 Token FCM atualizado:", token);
    // Salvar o novo token no banco de dados automaticamente
    try {
      const { getCurrentUser } = await import("./supabase/authService");
      const { saveFCMToken } = await import("./supabase/userService");
      const { user } = await getCurrentUser();
      if (user && token) {
        const result = await saveFCMToken(user.id, token);
        if (result.success) {
          console.log("✅ Token FCM atualizado e salvo no banco de dados!");
        } else {
          console.error(
            "❌ Erro ao salvar token FCM atualizado:",
            result.error,
          );
        }
      }
    } catch (error) {
      console.error("❌ Erro ao salvar token FCM atualizado:", error);
    }
  });

  console.log("✅ Handlers de notificações push configurados!");

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
  if (Platform.OS !== "ios") {
    // Android não precisa de permissão explícita
    return true;
  }

  try {
    // Verificar se Firebase está disponível
    messaging();
    const authStatus = await messaging().requestPermission();
    const enabled =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL;

    if (enabled) {
      console.log("✅ Permissão de notificação concedida:", authStatus);
      return true;
    } else {
      console.log("❌ Permissão de notificação negada:", authStatus);
      return false;
    }
  } catch (error) {
    console.error("Erro ao solicitar permissão:", error);
    return false;
  }
};

/**
 * Registrar dispositivo para mensagens remotas (iOS)
 */
export const registerDeviceForRemoteMessages = async (): Promise<boolean> => {
  if (Platform.OS !== "ios") {
    return true;
  }

  try {
    // Verificar se Firebase está disponível
    messaging();
    await messaging().registerDeviceForRemoteMessages();
    console.log("✅ Dispositivo registrado para mensagens remotas");
    return true;
  } catch (error: any) {
    if (error?.code === "messaging/device-already-registered") {
      console.log("✅ Dispositivo já estava registrado");
      return true;
    }
    console.error("Erro ao registrar dispositivo:", error);
    return false;
  }
};

/**
 * Obter token FCM atual
 */
export const getFCMToken = async (): Promise<string | null> => {
  try {
    // Verificar se Firebase está disponível
    messaging();
    const token = await messaging().getToken();
    console.log("🔑 Token FCM obtido:", token);
    return token;
  } catch (error) {
    console.error("Erro ao obter token FCM:", error);
    return null;
  }
};
