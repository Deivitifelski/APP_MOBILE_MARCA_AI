# 🔒 Como Resolver o Erro de RLS em Notifications

## ❌ Erro Atual

```
notificationManager: Erro ao criar notificação de convite: 
new row violates row-level security policy for table "notifications"
```

## 🔍 Causa do Problema

O erro ocorre porque a tabela `notifications` no Supabase tem **Row-Level Security (RLS)** habilitado, mas **não possui as políticas corretas** para permitir que usuários autenticados criem notificações.

Quando você tenta:
- Convidar um colaborador
- Adicionar alguém a um artista
- Criar qualquer tipo de notificação

O Supabase bloqueia a operação porque não há uma política RLS que permita `INSERT`.

---

## ✅ Solução - Execute no Supabase

### **Passo 1: Acesse o Supabase**
1. Vá para https://supabase.com/dashboard
2. Selecione seu projeto
3. No menu lateral, clique em **SQL Editor**

### **Passo 2: Execute o Script SQL**

Abra o arquivo `fix-notifications-rls.sql` e copie todo o conteúdo.

Cole no SQL Editor do Supabase e clique em **RUN**.

### **Passo 3: Verificar se Funcionou**

Após executar, você verá uma tabela mostrando as políticas criadas:

```
policyname                                    | cmd    | roles          
--------------------------------------------- | ------ | --------------
Users can view their own notifications        | SELECT | authenticated
Allow authenticated users to insert notifications | INSERT | authenticated
Users can update their own notifications      | UPDATE | authenticated
Users can delete their own notifications      | DELETE | authenticated
```

---

## 🎯 O Que as Políticas Fazem

### 📖 **SELECT** (Ver Notificações)
```sql
Permite que usuários vejam:
• Notificações que receberam (user_id = você)
• Notificações que enviaram (from_user_id = você)
```

### ➕ **INSERT** (Criar Notificações)
```sql
Permite que qualquer usuário autenticado crie notificações
Isso é necessário para:
• Convidar colaboradores
• Notificar sobre eventos
• Enviar alertas do sistema
```

### ✏️ **UPDATE** (Atualizar Notificações)
```sql
Permite que usuários marquem como lidas suas próprias notificações
Apenas o destinatário pode atualizar (user_id = você)
```

### 🗑️ **DELETE** (Deletar Notificações)
```sql
Permite que usuários deletem suas próprias notificações
```

---

## 🧪 Como Testar

Depois de executar o script:

1. **Tente convidar um colaborador**
2. **Verifique se a notificação foi criada**
3. **O erro não deve mais aparecer**

---

## 🚨 Se o Erro Persistir

### Opção 1: Verificar Autenticação
```typescript
// Certifique-se de que o usuário está autenticado
const { user } = await getCurrentUser();
if (!user) {
  console.error('Usuário não autenticado');
  return;
}
```

### Opção 2: Verificar Políticas Manualmente
No Supabase Dashboard:
1. Vá em **Database** → **Tables**
2. Selecione a tabela `notifications`
3. Clique na aba **Policies**
4. Certifique-se de que há uma política para `INSERT`

### Opção 3: Desabilitar RLS Temporariamente (NÃO RECOMENDADO EM PRODUÇÃO)
```sql
-- ⚠️ APENAS PARA DEBUG LOCAL
ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;
```

---

## 📝 Resumo

1. ✅ O script SQL corrige o problema
2. ✅ Execute uma única vez no Supabase
3. ✅ Depois, notificações funcionarão normalmente
4. ✅ Mantenha RLS habilitado para segurança

**Problema resolvido!** 🎉

