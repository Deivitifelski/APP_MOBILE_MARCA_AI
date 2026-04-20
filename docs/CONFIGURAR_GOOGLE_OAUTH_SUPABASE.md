# Como Configurar Google OAuth no Supabase

## Erro Atual
```
Unacceptable audience in id_token: [169304206053-1dnv4bsqrdbci79ktes1p0eqcfboctjb.apps.googleusercontent.com]
```

Este erro ocorre porque o Supabase não está configurado para aceitar o OAuth do Google.

## Passos para Configurar

### 1. Acesse o Supabase Dashboard
- Vá para: https://supabase.com/dashboard
- Selecione seu projeto

### 2. Configure o Google Provider
1. No menu lateral, clique em **Authentication**
2. Clique em **Providers**
3. Encontre **Google** na lista
4. Clique para expandir

### 3. Configurações do Google Provider
Adicione as seguintes informações:

**Client ID (for OAuth):**
```
169304206053-1dnv4bsqrdbci79ktes1p0eqcfboctjb.apps.googleusercontent.com
```

**Client Secret:**
- Você precisa obter isso do Google Cloud Console
- Vá para: https://console.cloud.google.com/
- Navegue até: APIs & Services > Credentials
- Encontre o OAuth 2.0 Client ID
- Copie o **Client Secret**

**Authorized redirect URIs (no Google Cloud Console):**
```
https://ctulmpyaikxsnjqmrzxf.supabase.co/auth/v1/callback
```

### 4. No Google Cloud Console
1. Acesse: https://console.cloud.google.com/
2. Selecione seu projeto
3. Vá para **APIs & Services** > **Credentials**
4. Clique no OAuth 2.0 Client ID que você está usando
5. Em **Authorized redirect URIs**, adicione:
   ```
   https://ctulmpyaikxsnjqmrzxf.supabase.co/auth/v1/callback
   ```
6. Clique em **Save**

### 5. Volte ao Supabase
1. Cole o **Client Secret** obtido do Google Cloud Console
2. Marque **Enable Sign in with Google**
3. Clique em **Save**

### 6. Teste o Login
Após configurar, o login com Google deve funcionar!

## Alternativa: Usar signInWithOAuth (mais simples)

Se quiser uma solução mais simples sem precisar do SDK nativo do Google, use:

```typescript
const { error } = await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    redirectTo: 'marcaai://',
  },
});
```

Este método:
- ✅ Não precisa de configuração extra do Google SDK
- ✅ Funciona em web e mobile
- ✅ Gerenciado 100% pelo Supabase
- ❌ Abre navegador externo (não é nativo)

## IDs do seu projeto

**Web Client ID:**
```
169304206053-1dnv4bsqrdbci79ktes1p0eqcfboctjb.apps.googleusercontent.com
```

**iOS Client ID:**
```
169304206053-642isf3lub3ds2thkiupcje9r7lo7dh7.apps.googleusercontent.com
```

**Supabase URL:**
```
https://ctulmpyaikxsnjqmrzxf.supabase.co
```

**Callback URL para adicionar no Google Cloud:**
```
https://ctulmpyaikxsnjqmrzxf.supabase.co/auth/v1/callback
```

