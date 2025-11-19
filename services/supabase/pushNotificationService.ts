import { supabase } from '../../lib/supabase';
import { getCurrentUser } from './authService';

export interface SendPushNotificationData {
  title: string;
  body: string;
  imageUrl?: string;
  data?: Record<string, any>;
}

export interface SendPushNotificationResult {
  success: boolean;
  error: string | null;
  messageId?: string;
}

/**
 * Busca o token FCM do usuário atual
 */
export const getCurrentUserFCMToken = async (): Promise<string | null> => {
  try {
    const { user } = await getCurrentUser();
    if (!user) {
      return null;
    }

    const { data, error } = await supabase
      .from('users')
      .select('token_fcm')
      .eq('id', user.id)
      .single();

    if (error || !data?.token_fcm) {
      console.log('⚠️ Token FCM não encontrado para o usuário');
      return null;
    }

    return data.token_fcm;
  } catch (error) {
    console.error('❌ Erro ao buscar token FCM:', error);
    return null;
  }
};

/**
 * Envia notificação push para o usuário atual usando Edge Function
 * 
 * @param notificationData - Dados da notificação
 * @returns Resultado do envio
 */
export const sendPushNotificationToCurrentUser = async (
  notificationData: SendPushNotificationData
): Promise<SendPushNotificationResult> => {
  try {
    console.log('📤 [sendPushNotificationToCurrentUser] Enviando notificação...');

    // Buscar token FCM do usuário atual
    const token = await getCurrentUserFCMToken();
    
    if (!token) {
      return {
        success: false,
        error: 'Token FCM não encontrado. O usuário precisa permitir notificações.',
      };
    }

    // Chamar Edge Function do Supabase
    const { data, error } = await supabase.functions.invoke('send-push-notification', {
      body: {
        token: token,
        title: notificationData.title,
        body: notificationData.body,
        imageUrl: notificationData.imageUrl,
        data: notificationData.data || {},
      },
    });

    if (error) {
      return { success: false, error: error.message };
    }

    if (data?.error) {
      console.error('❌ [sendPushNotificationToCurrentUser] Erro retornado:', data.error);
      return { success: false, error: data.error };
    }

    console.log('✅ [sendPushNotificationToCurrentUser] Notificação enviada com sucesso!');
    return {
      success: true,
      error: null,
      messageId: data?.messageId,
    };
  } catch (error: any) {
    console.error('❌ [sendPushNotificationToCurrentUser] Erro:', error);
    return { success: false, error: error?.message || 'Erro de conexão' };
  }
};

/**
 * Envia notificação push usando API REST do FCM diretamente
 * (Alternativa caso não use Edge Function)
 * 
 * NOTA: Requer FIREBASE_SERVER_KEY configurada
 */
export const sendPushNotificationDirect = async (
  token: string,
  notificationData: SendPushNotificationData
): Promise<SendPushNotificationResult> => {
  try {
    // Esta função requer uma Edge Function ou backend que tenha a Server Key
    // Por segurança, é melhor usar a Edge Function
    return await sendPushNotificationToCurrentUser(notificationData);
  } catch (error: any) {
    return { success: false, error: error?.message || 'Erro ao enviar notificação' };
  }
};


