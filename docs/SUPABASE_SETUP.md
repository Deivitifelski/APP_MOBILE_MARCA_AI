# Configuração do Supabase

## Passos para configurar o Supabase:

### 1. Criar projeto no Supabase
1. Acesse [supabase.com](https://supabase.com)
2. Faça login ou crie uma conta
3. Clique em "New Project"
4. Escolha sua organização
5. Preencha:
   - Project name: `marca-ai-app`
   - Database password: (crie uma senha forte)
   - Region: escolha a mais próxima do Brasil
6. Clique em "Create new project"

### 2. Obter as credenciais
1. No dashboard do projeto, vá em "Settings" > "API"
2. Copie:
   - Project URL
   - Project API keys > anon/public key

### 3. Configurar o arquivo lib/supabase.ts
Substitua as credenciais no arquivo `lib/supabase.ts`:

```typescript
const supabaseUrl = 'https://seu-projeto.supabase.co';
const supabaseAnonKey = 'sua-chave-anonima';
```

### 4. Configurar autenticação
1. No dashboard do Supabase, vá em "Authentication" > "Settings"
2. Em "Site URL", adicione: `exp://localhost:8081` (para desenvolvimento)
3. Em "Redirect URLs", adicione: `exp://localhost:8081`
4. Em "Email", configure:
   - Enable email confirmations: ✅
   - Email template: personalizar se desejar

### 5. Configurar políticas de segurança (RLS)
1. Vá em "Authentication" > "Policies"
2. Para a tabela `auth.users`, certifique-se de que as políticas estão configuradas corretamente

### 6. Testar a integração
1. Execute o app: `npx expo start`
2. Teste o cadastro de um novo usuário
3. Verifique se o email de confirmação é enviado
4. Teste o login após confirmar o email

## Funcionalidades implementadas:
- ✅ Cadastro de usuário com confirmação de email
- ✅ Login com verificação de email confirmado
- ✅ Tela de confirmação de email
- ✅ Reenvio de email de confirmação
- ✅ Validação de formulários
- ✅ Navegação entre telas

## Próximos passos:
- [ ] Implementar recuperação de senha
- [ ] Adicionar autenticação social (Google, Apple)
- [ ] Implementar logout
- [ ] Adicionar perfil do usuário
- [ ] Configurar notificações push
