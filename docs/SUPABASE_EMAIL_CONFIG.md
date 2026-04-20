# Configuração do Supabase para Envio de Emails

## Problema
O email de confirmação não está sendo enviado quando o usuário se cadastra.

## Soluções

### 1. Verificar Configurações de Autenticação no Supabase Dashboard

1. Acesse o [Supabase Dashboard](https://supabase.com/dashboard)
2. Vá para o projeto: `ctulmpyaikxsnjqmrzxf`
3. Navegue para **Authentication** > **Settings**
4. Verifique as seguintes configurações:

#### Email Confirmation
- **Enable email confirmations**: Deve estar **ATIVADO**
- **Confirm email**: Deve estar **ATIVADO**
- **Secure email change**: Pode estar ativado

#### Email Templates
- Vá para **Authentication** > **Email Templates**
- Verifique se o template "Confirm signup" está configurado
- O template deve conter um link de confirmação

### 2. Configurar SMTP (Recomendado)

Se você não configurou um provedor SMTP personalizado, o Supabase usa um serviço limitado.

1. No Dashboard, vá para **Settings** > **Auth**
2. Na seção **SMTP Settings**, configure:
   - **Enable custom SMTP**: ATIVAR
   - **Host**: smtp.gmail.com (para Gmail)
   - **Port**: 587
   - **Username**: seu-email@gmail.com
   - **Password**: senha de app do Gmail
   - **Sender name**: Marca AI
   - **Sender email**: seu-email@gmail.com

### 3. Verificar Site URL

1. Em **Authentication** > **URL Configuration**
2. **Site URL**: deve ser configurado para o seu app
3. **Redirect URLs**: adicione URLs permitidas

### 4. Testar Configuração

Após fazer as configurações:

1. Teste o cadastro no app
2. Verifique os logs no Supabase Dashboard em **Logs** > **Auth**
3. Verifique se o email foi enviado

### 5. Configurações Adicionais no Código

O código já foi atualizado para:
- Adicionar logs de debug
- Configurar `emailRedirectTo` no signUp
- Verificar se o email foi confirmado
- Mostrar mensagem apropriada ao usuário

### 6. Troubleshooting

Se ainda não funcionar:

1. Verifique se o email não está na pasta de spam
2. Verifique os logs do Supabase
3. Teste com um email diferente
4. Verifique se o domínio do email não está bloqueado

## Comandos para Testar

```bash
# Verificar logs do Supabase
npx expo start
# Testar cadastro e verificar console logs