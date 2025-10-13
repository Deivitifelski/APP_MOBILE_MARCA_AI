# 🔐 Configuração do Login com Google

Este guia explica como configurar o login com Google no app Marca AI.

## ✅ O que foi implementado

1. **Serviço de Autenticação Google** (`services/supabase/googleAuthService.ts`)
   - Login com Google via OAuth do Supabase
   - Criação automática de usuário no banco de dados
   - Salvamento de dados do perfil Google (nome, email, foto)
   - Tratamento de usuários novos e existentes

2. **Tela de Login Atualizada** (`app/screens/auth/LoginScreen.tsx`)
   - Botão "Continuar com Google" funcional
   - Tratamento de erros
   - Redirecionamento automático após login

3. **Deep Link Handler** (`components/AuthDeepLinkHandler.tsx`)
   - Processa callbacks do OAuth
   - Redireciona usuário após autenticação
   - Oferece completar perfil para novos usuários

## 📋 Configuração Necessária no Supabase

### Passo 1: Criar Projeto no Google Cloud Console

1. Acesse [Google Cloud Console](https://console.cloud.google.com/)
2. Crie um novo projeto ou selecione um existente
3. Ative a **Google+ API**

### Passo 2: Criar Credenciais OAuth 2.0

1. Vá para **APIs & Services > Credentials**
2. Clique em **Create Credentials > OAuth client ID**
3. Selecione **Application type: iOS** (para mobile) ou **Web application** (para web)
4. Configure:

   **Para iOS:**
   - **Name**: Marca AI iOS
   - **Bundle ID**: `com.anonymous.APP-MOBILE-MARCA-AI`
   
   **Para Web/Desenvolvimento:**
   - **Name**: Marca AI Web
   - **Authorized JavaScript origins**: 
     ```
     https://ctulmpyaikxsnjqmrzxf.supabase.co
     ```
   - **Authorized redirect URIs**: 
     ```
     https://ctulmpyaikxsnjqmrzxf.supabase.co/auth/v1/callback
     marcaai://auth/callback
     ```

5. Salve e copie o **Client ID** e **Client Secret**

   **Client ID atual**: `507253415369-bl50sd12odg2h4ktds2ht26i95c057qm.apps.googleusercontent.com`

### Passo 3: Configurar no Supabase

1. Acesse seu projeto no [Supabase Dashboard](https://supabase.com/dashboard)
2. Vá para **Authentication > Providers**
3. Encontre **Google** e clique para expandir
4. Configure:
   - **Enable**: ✅ Ativar
   - **Client ID**: `507253415369-bl50sd12odg2h4ktds2ht26i95c057qm.apps.googleusercontent.com`
   - **Client Secret**: Cole o Client Secret do Google Console
   - **Redirect URL**: `https://ctulmpyaikxsnjqmrzxf.supabase.co/auth/v1/callback`

5. Clique em **Save**

**IMPORTANTE**: Use a URL de redirect **EXATAMENTE** como mostrada acima. Esta é a URL que o Supabase usa para processar o callback do Google.

### Passo 4: Configurar Deep Linking para Mobile

O app já está configurado com o scheme `marcaai://`.

**Para iOS:**
- O esquema `marcaai://` já está configurado no `app.json`
- URL de callback: `marcaai://auth/callback`

**Para Android:**
- O intent filter `marcaai://` já está configurado no `app.json`
- URL de callback: `marcaai://auth/callback`

### Passo 5: Verificar URLs de Redirect no Google Console

Certifique-se de que as seguintes URLs estão configuradas no Google Cloud Console:

**Authorized redirect URIs:**
```
https://ctulmpyaikxsnjqmrzxf.supabase.co/auth/v1/callback
marcaai://auth/callback
```

**Authorized JavaScript origins:**
```
https://ctulmpyaikxsnjqmrzxf.supabase.co
```

**IMPORTANTE**: 
- O Google precisa da URL `https://...supabase.co/auth/v1/callback` para processar o OAuth
- O app precisa da URL `marcaai://auth/callback` para receber o deep link de retorno

## 🔄 Fluxo de Autenticação

1. **Usuário clica em "Continuar com Google"**
   - App abre navegador com tela de login do Google
   - Usuário faz login e autoriza o app

2. **Google redireciona de volta ao app**
   - Deep link `marcaai://auth/callback` é acionado
   - App processa tokens OAuth

3. **App verifica usuário no banco**
   - **Se é novo usuário:**
     - Cria registro na tabela `users` com dados do Google
     - Oferece completar perfil (telefone, cidade, estado)
   - **Se usuário já existe:**
     - Faz login direto
     - Redireciona para agenda

4. **Usuário é logado**
   - Sessão é salva localmente
   - Acesso completo ao app

## 📊 Dados Salvos do Google

Quando um novo usuário faz login com Google, os seguintes dados são salvos:

```typescript
{
  id: string,              // ID do Supabase Auth
  email: string,           // Email do Google
  name: string,            // Nome completo do Google
  profile_url: string,     // Foto do perfil do Google
  phone: '',              // Vazio (pode completar depois)
  city: '',               // Vazio (pode completar depois)
  state: '',              // Vazio (pode completar depois)
  plan: 'free'            // Plano inicial gratuito
}
```

## 🧪 Testando

### No Desenvolvimento (Expo Go)

1. Execute o app:
   ```bash
   npx expo start
   ```

2. Clique em "Continuar com Google"
3. Faça login na conta Google
4. Autorize o app
5. Será redirecionado de volta ao app

### Em Produção

1. Build o app com EAS:
   ```bash
   eas build --platform ios
   eas build --platform android
   ```

2. Instale o app no dispositivo
3. Teste o fluxo completo

## 🐛 Troubleshooting

### Erro: "redirect_uri_mismatch"
- **Problema**: A URL de redirect não está configurada corretamente
- **Solução**: Verifique se todas as URLs de redirect foram adicionadas no Google Console

### Erro: "invalid_client"
- **Problema**: Client ID ou Secret inválido
- **Solução**: Verifique se copiou corretamente as credenciais no Supabase

### Erro: "Popup blocked"
- **Problema**: Navegador bloqueou o popup de login
- **Solução**: Permita popups para o domínio do Supabase

### Deep link não funciona
- **Problema**: Scheme não configurado corretamente
- **Solução**: 
  - Verifique o `app.json`
  - Rebuilde o app nativo (iOS/Android)
  - Não funciona no Expo Go em alguns casos

## 📱 Customização do Botão Google

O botão já está estilizado na tela de login. Para customizar:

```tsx
// app/screens/auth/LoginScreen.tsx

<TouchableOpacity
  style={dynamicStyles.googleButton}
  onPress={handleGoogleLogin}
  disabled={loading}
>
  <Ionicons name="logo-google" size={20} color="#DB4437" />
  <Text style={dynamicStyles.googleButtonText}>
    Continuar com Google
  </Text>
</TouchableOpacity>
```

## 🔒 Segurança

- ✅ OAuth 2.0 padrão do Google
- ✅ Tokens criptografados pelo Supabase
- ✅ Sessão segura com refresh tokens
- ✅ Deep linking com esquema personalizado
- ✅ Verificação de email automática (Google)

## 📝 Notas Importantes

1. **Plano do Usuário**: Novos usuários começam no plano "free"
2. **Email Verificado**: Emails do Google já vêm verificados
3. **Perfil Incompleto**: Usuários podem completar telefone/endereço depois
4. **Múltiplos Artistas**: Usuários Google podem criar artistas normalmente
5. **Logout**: Use o logout padrão do app (já configurado)

## 🚀 Próximos Passos

Após configurar:

1. Teste em desenvolvimento
2. Configure credenciais de produção no Google
3. Build o app com EAS
4. Teste em dispositivos físicos
5. Publique nas stores

---

**Documentação criada em**: Janeiro 2025  
**Última atualização**: Janeiro 2025

