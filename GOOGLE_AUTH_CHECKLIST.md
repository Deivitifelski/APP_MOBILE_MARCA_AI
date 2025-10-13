# ✅ Checklist Rápido - Login com Google

Use este checklist para configurar o login com Google no app Marca AI.

## 📋 Informações do Projeto

- **Client ID**: `507253415369-bl50sd12odg2h4ktds2ht26i95c057qm.apps.googleusercontent.com`
- **Supabase Project ID**: `ctulmpyaikxsnjqmrzxf`
- **App Scheme**: `marcaai://`
- **Bundle ID iOS**: `com.anonymous.APP-MOBILE-MARCA-AI`
- **Package Android**: `com.anonymous.APP_MOBILE_MARCA_AI`

---

## 🔧 Configuração no Google Cloud Console

### 1. Acesse o Google Cloud Console
- URL: https://console.cloud.google.com/
- Selecione seu projeto ou crie um novo

### 2. Ative as APIs necessárias
- [ ] Google+ API ativada
- [ ] Google OAuth 2.0 habilitado

### 3. Configure Credenciais OAuth 2.0

Vá para: **APIs & Services > Credentials**

#### Para Web/Desenvolvimento:
- [ ] **Application type**: Web application
- [ ] **Name**: Marca AI Web
- [ ] **Authorized JavaScript origins**:
  ```
  https://ctulmpyaikxsnjqmrzxf.supabase.co
  ```
- [ ] **Authorized redirect URIs**:
  ```
  https://ctulmpyaikxsnjqmrzxf.supabase.co/auth/v1/callback
  marcaai://auth/callback
  ```

#### Para iOS (opcional, se quiser Client ID nativo):
- [ ] **Application type**: iOS
- [ ] **Name**: Marca AI iOS
- [ ] **Bundle ID**: `com.anonymous.APP-MOBILE-MARCA-AI`

#### Para Android (opcional):
- [ ] **Application type**: Android
- [ ] **Name**: Marca AI Android
- [ ] **Package name**: `com.anonymous.APP_MOBILE_MARCA_AI`
- [ ] **SHA-1 certificate fingerprint**: (obter com `keytool` ou EAS)

---

## 🗄️ Configuração no Supabase

### 1. Acesse o Supabase Dashboard
- URL: https://supabase.com/dashboard/project/ctulmpyaikxsnjqmrzxf

### 2. Configure o Provider Google

Vá para: **Authentication > Providers > Google**

- [ ] **Enable Sign in with Google**: ✅ Ativado
- [ ] **Client ID (for OAuth)**:
  ```
  507253415369-bl50sd12odg2h4ktds2ht26i95c057qm.apps.googleusercontent.com
  ```
- [ ] **Client Secret (for OAuth)**: Cole o secret do Google Console
- [ ] **Authorized Client IDs**: (opcional, para iOS/Android nativos)

### 3. Verificar Redirect URLs

A URL de callback do Supabase deve ser:
```
https://ctulmpyaikxsnjqmrzxf.supabase.co/auth/v1/callback
```

Esta URL é gerada automaticamente pelo Supabase. Use ela no Google Console.

### 4. Configurar Deep Links (Mobile)

Vá para: **Authentication > URL Configuration**

- [ ] **Site URL**: `https://ctulmpyaikxsnjqmrzxf.supabase.co`
- [ ] **Redirect URLs**: Adicione:
  ```
  marcaai://auth/callback
  marcaai://
  ```

---

## 📱 Teste no App

### 1. Certifique-se de que o app está rodando
```bash
export PATH="/opt/homebrew/opt/node@20/bin:$PATH"
npx expo start
```

### 2. Abra no simulador/dispositivo
- Pressione `i` para iOS
- Pressione `a` para Android

### 3. Teste o Login
1. Clique em "Continuar com Google"
2. Navegador deve abrir com tela de login do Google
3. Faça login com uma conta Google
4. Autorize o app
5. Deve retornar ao app e fazer login automaticamente

### 4. Verifique os Logs
Procure por:
```
✅ OAuth iniciado, URL: https://...
🔗 Deep link recebido: marcaai://...
✅ Autenticação Google concluída!
```

---

## 🐛 Problemas Comuns

### ❌ **Erro 404 ao clicar em "Continuar com Google"**
**Causa**: O provider Google não está habilitado no Supabase

**Solução**: 
1. Acesse: https://supabase.com/dashboard/project/ctulmpyaikxsnjqmrzxf/auth/providers
2. Encontre **Google** e clique em **Enable**
3. Cole o Client ID e Client Secret
4. **SALVE** as configurações
5. Teste novamente

### ❌ "redirect_uri_mismatch"
**Solução**: Verifique se TODAS as URLs de redirect estão configuradas no Google Console:
- `https://ctulmpyaikxsnjqmrzxf.supabase.co/auth/v1/callback`
- `marcaai://auth/callback` (opcional, para fallback)

### ❌ "invalid_client"
**Solução**: 
1. Verifique se o Client ID está correto no Supabase
2. Verifique se o Client Secret está correto
3. Certifique-se de que salvou as configurações
4. Aguarde até 5 minutos para propagação

### ❌ Deep link não funciona
**Solução**: 
1. Rebuilde o app: `npx expo run:ios` ou `npx expo run:android`
2. Verifique se o `app.json` tem o scheme `marcaai`
3. No iOS, verifique os `CFBundleURLSchemes`

### ❌ "WebCrypto API is not supported"
**Isso é normal!** É apenas um warning. O código funciona mesmo com `code_challenge_method=plain`.

---

## ✅ Teste de Sucesso

Quando tudo estiver configurado corretamente, você verá:

1. **Navegador abre** com tela de login do Google
2. **Após login**, navegador fecha automaticamente
3. **App recebe deep link**: `marcaai://auth/callback?access_token=...`
4. **Usuário é criado** no banco de dados com:
   - Email do Google
   - Nome completo
   - Foto do perfil
   - Plano: "free"
5. **Redirecionamento** automático para a agenda

---

## 📞 Suporte

Se encontrar problemas:
1. Verifique os logs do console
2. Consulte `GOOGLE_AUTH_SETUP.md` para detalhes completos
3. Verifique as configurações no Google Console
4. Verifique as configurações no Supabase Dashboard

**Data de criação**: Outubro 2025  
**Última atualização**: Outubro 2025

