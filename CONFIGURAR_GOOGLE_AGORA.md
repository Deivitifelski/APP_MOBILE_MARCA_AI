# 🚀 Configure o Google OAuth AGORA (Passo a Passo)

## ❌ ERRO ATUAL: 404

O erro 404 acontece porque o **Google OAuth não está habilitado no Supabase**.

Siga estes passos para resolver:

---

## 📋 PASSO 1: Obter Client Secret do Google

### 1.1. Acesse o Google Cloud Console
```
https://console.cloud.google.com/apis/credentials
```

### 1.2. Encontre suas credenciais
- Procure pelo Client ID: `507253415369-bl50sd12odg2h4ktds2ht26i95c057qm...`
- Clique nele para ver os detalhes

### 1.3. Copie o Client Secret
- No painel de detalhes, você verá o **Client Secret**
- Clique em **copiar** ou anote-o

**OU crie novas credenciais se não existir:**

1. Clique em **+ CREATE CREDENTIALS**
2. Selecione **OAuth client ID**
3. Tipo: **Web application**
4. Nome: **Marca AI**
5. **Authorized JavaScript origins**:
   ```
   https://ctulmpyaikxsnjqmrzxf.supabase.co
   ```
6. **Authorized redirect URIs**:
   ```
   https://ctulmpyaikxsnjqmrzxf.supabase.co/auth/v1/callback
   ```
7. Clique em **CREATE**
8. Copie o **Client ID** e **Client Secret** que aparecerem

---

## 📋 PASSO 2: Configurar no Supabase

### 2.1. Acesse o Supabase Dashboard
```
https://supabase.com/dashboard/project/ctulmpyaikxsnjqmrzxf/auth/providers
```

### 2.2. Encontre o Google Provider
- Na lista de providers, procure por **Google**
- Clique nele para expandir

### 2.3. Habilite e Configure

**⚠️ IMPORTANTE: Preencha EXATAMENTE como abaixo:**

1. **Enable Sign in with Google**: ✅ **MARQUE ESTA OPÇÃO**

2. **Client ID (for OAuth)**:
   ```
   507253415369-bl50sd12odg2h4ktds2ht26i95c057qm.apps.googleusercontent.com
   ```

3. **Client Secret (for OAuth)**:
   ```
   [COLE O SECRET QUE VOCÊ COPIOU DO GOOGLE CONSOLE]
   ```

4. **Skip nonce check**: ❌ Deixe desmarcado

5. Clique em **SAVE** no canto inferior direito

### 2.4. Aguarde
- Aguarde 10-30 segundos para as configurações serem aplicadas

---

## 🧪 PASSO 3: Testar no App

### 3.1. Volte ao App (simulador)
- O app já está rodando

### 3.2. Clique em "Continuar com Google"
- ✅ Navegador deve abrir
- ✅ Tela de login do Google aparece
- ✅ **Escolha sua conta Google** ou faça login
- ✅ Autorize o app "Marca AI"
- ✅ Navegador fecha automaticamente
- ✅ App salva seus dados no banco:
  - Nome
  - Email  
  - Foto do perfil
  - Plano: free
- ✅ Você é redirecionado para a Agenda

---

## ✅ O que vai acontecer:

### Quando você clicar em "Continuar com Google":

```
1. Modal/Navegador abre
   ↓
2. Tela do Google: "Fazer login com o Google"
   ↓
3. Você escolhe/faz login na conta
   ↓
4. Google pergunta: "Marca AI quer acessar sua Conta do Google"
   - Ver informações básicas do perfil
   - Ver endereço de e-mail
   ↓
5. Você clica em "Permitir"
   ↓
6. Navegador fecha automaticamente
   ↓
7. App processa automaticamente:
   - Cria registro na tabela 'users' (se novo)
   - Salva: email, nome, foto
   - Define plano como 'free'
   ↓
8. Redirecionamento para Agenda
   ↓
9. ✅ VOCÊ ESTÁ LOGADO!
```

---

## 🎯 Dados que serão salvos automaticamente:

Quando um **novo usuário** faz login com Google:

```sql
INSERT INTO users (
  id,           -- ID do Supabase Auth
  email,        -- seu.email@gmail.com
  name,         -- "Seu Nome Completo"
  profile_url,  -- "https://lh3.googleusercontent.com/..."
  phone,        -- "" (vazio, pode completar depois)
  city,         -- "" (vazio, pode completar depois)
  state,        -- "" (vazio, pode completar depois)
  plan          -- "free"
)
```

---

## 📞 Se não funcionar:

### Verifique:

1. **No Supabase**: Provider Google está **ENABLED** (marcado)?
2. **No Supabase**: Client ID e Secret estão **corretos**?
3. **No Supabase**: Você clicou em **SAVE**?
4. **No Google Console**: Redirect URI `https://ctulmpyaikxsnjqmrzxf.supabase.co/auth/v1/callback` está adicionada?

### Logs para observar:

Quando funcionar, você verá:
```
🔐 [Google Auth] Iniciando autenticação...
✅ [Google Auth] URL OAuth gerada
🔙 [Google Auth] Retorno do navegador: success
🔑 [Google Auth] Processando tokens...
✅ [Google Auth] Sessão criada com sucesso!
📝 [Google Auth] Criando perfil...
✅ [Google Auth] Perfil criado com sucesso!
```

---

**Configure agora e teste!** 🚀

