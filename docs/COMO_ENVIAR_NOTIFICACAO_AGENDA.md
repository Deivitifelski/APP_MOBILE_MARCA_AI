# 📱 Como Enviar Notificação ao Entrar na Agenda

## ✅ O que foi implementado

1. **Serviço de Push Notification** (`services/supabase/pushNotificationService.ts`)
   - Função `sendPushNotificationToCurrentUser()` que busca o token FCM do usuário e envia notificação
   - Função `getCurrentUserFCMToken()` para buscar o token do usuário atual

2. **Integração na Tela de Agenda** (`app/(tabs)/agenda.tsx`)
   - Notificação enviada automaticamente quando a tela recebe foco
   - Usa `useFocusEffect` para detectar quando o usuário entra na tela

3. **Edge Function** (`supabase/functions/send-push-notification/index.ts`)
   - Função serverless que envia notificações via API REST do FCM
   - Formato similar ao Firebase Admin SDK

## 🚀 Como funciona

Quando o usuário entra na tela de agenda:

1. O `useFocusEffect` detecta que a tela recebeu foco
2. A função `sendWelcomeNotification()` é chamada
3. O serviço busca o `token_fcm` do usuário atual no banco de dados
4. Chama a Edge Function do Supabase com os dados da notificação
5. A Edge Function envia a notificação via API REST do FCM

## 📝 Formato da Notificação

```typescript
await sendPushNotificationToCurrentUser({
  title: 'Bem-vindo à Agenda!',
  body: 'Confira seus eventos e shows agendados.',
  imageUrl: 'https://my-cdn.com/app-logo.png', // Opcional
  data: {
    screen: 'agenda',
    timestamp: new Date().toISOString(),
  },
});
```

## 🔧 Configuração Necessária

### 1. Configurar Edge Function no Supabase

```bash
# Instalar Supabase CLI (se não tiver)
npm install -g supabase

# Fazer login
supabase login

# Linkar projeto
supabase link --project-ref seu-project-ref

# Configurar a chave do Firebase
supabase secrets set FIREBASE_SERVER_KEY=sua-chave-aqui

# Fazer deploy da função
supabase functions deploy send-push-notification
```

### 2. Obter a Server Key do Firebase

1. Acesse o [Firebase Console](https://console.firebase.google.com/)
2. Vá em **Configurações do Projeto** → **Cloud Messaging**
3. Copie a **Server Key**

## 🎨 Personalizar a Notificação

Para personalizar a mensagem, edite o arquivo `app/(tabs)/agenda.tsx`:

```typescript
const result = await sendPushNotificationToCurrentUser({
  title: 'Seu Título Aqui',
  body: 'Sua mensagem aqui',
  imageUrl: 'https://url-da-imagem.com/logo.png', // Opcional
  data: {
    screen: 'agenda',
    // Dados customizados
  },
});
```

## 🔍 Verificar se está funcionando

1. Abra o app no iPhone
2. Faça login
3. Navegue para a tela de Agenda
4. Verifique os logs do console:
   - Deve aparecer: `✅ Notificação enviada com sucesso ao entrar na agenda`
   - OU: `⚠️ Não foi possível enviar notificação: [erro]`

## ⚠️ Troubleshooting

### Erro: "Token FCM não encontrado"

- Verifique se o usuário concedeu permissão de notificações
- Verifique se o token foi salvo no banco de dados após o login
- Verifique os logs: `💾 [saveFCMToken] Token FCM salvo com sucesso!`

### Erro: "FIREBASE_SERVER_KEY não configurada"

- Configure a variável de ambiente: `supabase secrets set FIREBASE_SERVER_KEY=sua-chave`
- Verifique se a função foi deployada: `supabase functions deploy send-push-notification`

### Notificação não aparece

- Verifique se o APNs está configurado no Firebase (para iOS)
- Verifique se as permissões foram concedidas
- Verifique os logs da Edge Function no Supabase Dashboard

## 📚 Arquivos Relacionados

- `services/supabase/pushNotificationService.ts` - Serviço de envio
- `app/(tabs)/agenda.tsx` - Tela de agenda (integração)
- `supabase/functions/send-push-notification/index.ts` - Edge Function
- `GUIA_CONFIGURAR_NOTIFICACOES_IOS.md` - Guia completo de configuração


