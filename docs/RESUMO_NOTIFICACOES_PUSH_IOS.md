# 📱 Resumo: Configuração de Notificações Push no iOS

## ✅ O que foi implementado

1. **Serviço de Handlers de Notificações** (`services/pushNotificationHandler.ts`)
   - Handler para notificações em foreground (app aberto)
   - Handler para quando app é aberto via notificação
   - Handler para notificação que abriu o app (app estava fechado)
   - Handler para atualização de token FCM
   - Funções auxiliares para permissões e registro

2. **Integração no App Principal** (`app/index.tsx`)
   - Handlers configurados automaticamente ao iniciar o app
   - Limpeza adequada dos listeners

## 🔧 O que você precisa fazer

### 1. Configurar APNs no Firebase (CRÍTICO)

**Este é o passo mais importante!** Sem isso, as notificações não funcionarão no iOS.

1. Acesse o [Firebase Console](https://console.firebase.google.com/)
2. Vá em **Configurações do Projeto** → **Cloud Messaging**
3. Na seção **Apple app configuration**, faça upload do certificado APNs

**Como obter o certificado:**
- Via Xcode: Preferences → Accounts → Manage Certificates → Criar certificado APNs
- OU via Apple Developer Portal: Certificates → Criar certificado APNs

### 2. Verificar no Xcode

1. Abra o projeto no Xcode
2. Selecione o target do app
3. Vá em **Signing & Capabilities**
4. Adicione a capability **Push Notifications** (se não estiver)

### 3. Testar

1. Abra o app no iPhone
2. Faça login
3. Verifique os logs do console:
   - Deve aparecer: `🔔 Configurando handlers de notificações push...`
   - Deve aparecer: `🔑 Token FCM obtido: [token]`
4. Envie uma notificação de teste via Firebase Console

## 🐛 Problema: Notificações não aparecem

### Verificações:

1. **APNs configurado?**
   - Verifique no Firebase Console se o certificado está configurado
   - Verifique se o Bundle ID corresponde

2. **Permissões concedidas?**
   - O app deve solicitar permissão de notificações
   - Verifique nas configurações do iPhone: Configurações → [Seu App] → Notificações

3. **Token FCM gerado?**
   - Verifique os logs do console
   - Procure por: `🔑 Token FCM obtido:`

4. **App em background?**
   - No iOS, notificações em background só funcionam se o APNs estiver configurado
   - Notificações em foreground (app aberto) mostram um Alert manual

## 📚 Documentação

- **Guia completo**: `GUIA_CONFIGURAR_NOTIFICACOES_IOS.md`
- **Serviço de handlers**: `services/pushNotificationHandler.ts`

## ⚠️ Importante

- **APNs é obrigatório** para notificações em background no iOS
- Sem APNs configurado, apenas notificações em foreground funcionarão (com Alert manual)
- O certificado APNs deve corresponder ao Bundle ID do app
- Certificados APNs podem expirar - verifique periodicamente

## 🎯 Próximos Passos

1. ✅ Configurar APNs no Firebase
2. ✅ Testar notificação de teste
3. ✅ Verificar se notificações aparecem em background
4. ✅ Implementar navegação quando notificação é clicada (opcional)


