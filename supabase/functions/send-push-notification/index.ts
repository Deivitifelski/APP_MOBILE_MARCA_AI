// Supabase Edge Function para enviar notificações push via FCM
// 
// Para usar esta função, você precisa:
// 1. Obter a chave do servidor Firebase (Server Key)
// 2. Configurar como variável de ambiente no Supabase: FIREBASE_SERVER_KEY
// 3. Deploy desta função no Supabase

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const FIREBASE_SERVER_KEY = Deno.env.get('FIREBASE_SERVER_KEY');
const FCM_URL = 'https://fcm.googleapis.com/fcm/send';

interface RequestBody {
  token: string;
  title: string;
  body: string;
  imageUrl?: string;
  data?: Record<string, any>;
}

serve(async (req) => {
  try {
    // Verificar se a chave do Firebase está configurada
    if (!FIREBASE_SERVER_KEY) {
      return new Response(
        JSON.stringify({ error: 'FIREBASE_SERVER_KEY não configurada' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Obter dados da requisição
    const { token, title, body, imageUrl, data } = await req.json() as RequestBody;

    if (!token || !title || !body) {
      return new Response(
        JSON.stringify({ error: 'Token, título e corpo da notificação são obrigatórios' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Preparar payload da notificação FCM
    // Formato similar ao Firebase Admin SDK
    const fcmPayload: any = {
      to: token, // Para um único token
      notification: {
        title: title,
        body: body,
        sound: 'default',
        badge: '1',
      },
      data: {
        ...data,
        click_action: 'FLUTTER_NOTIFICATION_CLICK', // Para abrir o app quando clicar
      },
      priority: 'high',
    };

    // Adicionar imagem se fornecida
    if (imageUrl) {
      fcmPayload.notification.imageUrl = imageUrl;
    }

    // Enviar notificação via FCM
    const fcmResponse = await fetch(FCM_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `key=${FIREBASE_SERVER_KEY}`,
      },
      body: JSON.stringify(fcmPayload),
    });

    const fcmResult = await fcmResponse.json();

    if (!fcmResponse.ok) {
      console.error('Erro ao enviar notificação FCM:', fcmResult);
      return new Response(
        JSON.stringify({ error: fcmResult.error || 'Erro ao enviar notificação' }),
        { status: fcmResponse.status, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        messageId: fcmResult.message_id || fcmResult.results?.[0]?.message_id,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Erro na função:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Erro interno do servidor' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});


