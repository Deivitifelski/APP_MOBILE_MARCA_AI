# 🔔 Guia: Configurar Notificações Push no iOS

Este guia explica como configurar notificações push no iOS para que funcionem corretamente.

## ✅ O que já está implementado

1. ✅ Handlers de notificações configurados (`services/pushNotificationHandler.ts`)
2. ✅ Solicitação de permissões
3. ✅ Registro do dispositivo
4. ✅ Obtenção do token FCM

## 🔧 Configurações Necessárias

### 1. Configurar APNs no Firebase Console

#### Passo 1: Obter o certificado APNs

1. Abra o **Xcode**
2. Vá em **Preferences** → **Accounts**
3. Selecione sua conta Apple
4. Clique em **Manage Certificates**
5. Clique no **+** e selecione **Apple Push Notification service SSL (Sandbox & Production)**
6. Selecione seu App ID (com.marcaai.app)
7. Baixe o certificado

**OU** use o método via Keychain:

1. Abra o **Keychain Access** no Mac
2. Vá em **Certificates**
3. Exporte o certificado APNs (se já tiver)
4. Converta para formato .p12

#### Passo 2: Fazer upload no Firebase

1. Acesse o [Firebase Console](https://console.firebase.google.com/)
2. Selecione seu projeto
3. Vá em **Configurações do Projeto** (ícone de engrenagem)
4. Aba **Cloud Messaging**
5. Na seção **Apple app configuration**, clique em **Upload**
6. Faça upload do certificado .p12 ou da chave APNs

**IMPORTANTE**: Você precisa de:
- **APNs Auth Key** (recomendado) OU
- **APNs Certificate** (.p12)

### 2. Verificar Configurações no Xcode

#### Passo 1: Habilitar Push Notifications

1. Abra o projeto no Xcode
2. Selecione o target do app
3. Vá em **Signing & Capabilities**
4. Clique em **+ Capability**
5. Adicione **Push Notifications**

#### Passo 2: Verificar Bundle Identifier

Certifique-se de que o Bundle Identifier está correto:
- Deve ser: `com.marcaai.app`
- Deve corresponder ao App ID configurado no Apple Developer

### 3. Verificar Configurações no app.json

O `app.json` já deve ter as configurações corretas. Verifique:

```json
{
  "ios": {
    "bundleIdentifier": "com.marcaai.app"
  }
}
```

### 4. Testar Notificações

#### Teste 1: Verificar Token FCM

1. Abra o app no iPhone
2. Faça login
3. Verifique os logs do console
4. Procure por: `🔑 Token FCM obtido:`
5. Copie o token

#### Teste 2: Enviar Notificação de Teste

**Opção A: Via Firebase Console**

1. Acesse o Firebase Console
2. Vá em **Cloud Messaging**
3. Clique em **Send test message**
4. Cole o token FCM
5. Digite título e mensagem
6. Clique em **Test**

**Opção B: Via API**

```bash
curl -X POST https://fcm.googleapis.com/fcm/send \
  -H "Authorization: key=SUA_SERVER_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "TOKEN_FCM_AQUI",
    "notification": {
      "title": "Teste",
      "body": "Esta é uma notificação de teste"
    }
  }'
```

## 🐛 Troubleshooting

### Problema: Notificações não aparecem

#### Verificar 1: Permissões

```typescript
// Verificar se as permissões foram concedidas
const authStatus = await messaging().requestPermission();
console.log('Status:', authStatus);
// Deve ser: 1 (AUTHORIZED) ou 2 (PROVISIONAL)
```

#### Verificar 2: Token FCM

```typescript
// Verificar se o token está sendo gerado
const token = await messaging().getToken();
console.log('Token:', token);
// Deve retornar um token válido
```

#### Verificar 3: APNs Configurado

- Verifique se o certificado APNs está configurado no Firebase
- Verifique se o Bundle ID corresponde
- Verifique se o certificado não expirou

#### Verificar 4: App em Background

No iOS, notificações em background só funcionam se:
- O APNs estiver configurado corretamente
- O app tiver a capability "Push Notifications" habilitada
- O certificado estiver válido no Firebase

### Problema: Notificações aparecem mas não abrem o app

Verifique se o handler `onNotificationOpenedApp` está configurado:

```typescript
// Já está configurado em services/pushNotificationHandler.ts
messaging().onNotificationOpenedApp(remoteMessage => {
  console.log('App aberto via notificação:', remoteMessage);
  // Navegar para a tela apropriada
});
```

### Problema: Token FCM não é gerado

1. Verifique se as permissões foram concedidas
2. Verifique se o dispositivo está registrado (iOS):
   ```typescript
   await messaging().registerDeviceForRemoteMessages();
   ```
3. Verifique os logs do console para erros

## 📱 Estados do App

### Foreground (App Aberto)

Quando o app está aberto, as notificações são capturadas por:
```typescript
messaging().onMessage(remoteMessage => {
  // Mostrar alerta manualmente no iOS
});
```

### Background (App em Segundo Plano)

Quando o app está em background, o iOS mostra a notificação automaticamente se:
- APNs estiver configurado
- O payload tiver `notification` (não apenas `data`)

### Terminated (App Fechado)

Quando o app está fechado, use:
```typescript
messaging().getInitialNotification()
```

## 🔍 Verificar Logs

Para debugar, verifique os logs:

```bash
# iOS Simulator
npx react-native log-ios

# iPhone físico (via Xcode)
# Window → Devices and Simulators → Selecionar dispositivo → View Device Logs
```

Procure por:
- `🔔 Configurando handlers de notificações push...`
- `📬 Notificação recebida em FOREGROUND:`
- `🔑 Token FCM obtido:`
- `✅ Permissão de notificação concedida`

## ✅ Checklist

- [ ] Certificado APNs configurado no Firebase
- [ ] Push Notifications capability habilitada no Xcode
- [ ] Bundle ID correto
- [ ] Permissões solicitadas e concedidas
- [ ] Token FCM sendo gerado
- [ ] Handlers configurados no app
- [ ] Teste de notificação funcionando

## 📚 Recursos

- [Firebase Cloud Messaging - iOS Setup](https://firebase.google.com/docs/cloud-messaging/ios/client)
- [React Native Firebase - Messaging](https://rnfirebase.io/messaging/usage)
- [Apple Push Notification Service](https://developer.apple.com/documentation/usernotifications)


