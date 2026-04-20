# 🎯 Sistema de Convites com Role

## ✅ Implementação Completa

Agora os convites de artista incluem a **role** escolhida pelo remetente, e essa role é automaticamente aplicada quando o convite é aceito!

---

## 📋 Mudanças Implementadas

### 1. **Banco de Dados - Duas Novas Colunas**

Execute estes SQLs no Supabase:

```sql
-- Adicionar role na tabela artist_invites
ALTER TABLE artist_invites 
  ADD COLUMN IF NOT EXISTS role TEXT 
  CHECK (role IN ('viewer', 'editor', 'admin', 'owner')) 
  DEFAULT 'viewer';

-- Adicionar role na tabela notifications
ALTER TABLE notifications 
  ADD COLUMN IF NOT EXISTS role TEXT 
  CHECK (role IN ('viewer', 'editor', 'admin', 'owner'));
```

**Por que duas tabelas?**
- `artist_invites.role` → Guarda a role do convite
- `notifications.role` → Cópia para exibir direto na notificação (evita query extra)

---

### 2. **Backend - Interfaces Atualizadas**

#### `notificationService.ts`:
```typescript
export interface Notification {
  ...
  role?: 'viewer' | 'editor' | 'admin' | 'owner'; // ✅ Role do convite
  ...
}

export interface CreateNotificationData {
  ...
  role?: 'viewer' | 'editor' | 'admin' | 'owner'; // ✅
  ...
}
```

#### `artistInviteService.ts`:
```typescript
export interface ArtistInvite {
  ...
  role: 'viewer' | 'editor' | 'admin' | 'owner'; // ✅
  ...
}

export interface CreateInviteData {
  ...
  role?: 'viewer' | 'editor' | 'admin' | 'owner'; // ✅
}
```

---

### 3. **Criação do Convite com Role**

#### `artistInviteService.ts` (linha 57):
```typescript
const { data: invite, error } = await supabase
  .from('artist_invites')
  .insert({
    artist_id: data.artistId,
    from_user_id: data.fromUserId,
    to_user_id: data.toUserId,
    role: data.role || 'viewer', // ✅ Salvar role escolhida
    status: 'pending',
    ...
  })
```

#### `colaboradores-artista.tsx` (linha 212):
```typescript
const { success, error, invite } = await createArtistInvite({
  artistId: activeArtist.id,
  toUserId: selectedUser.id,
  fromUserId: currentUser.id,
  role: newCollaboratorRole // ✅ Role do dropdown
});
```

---

### 4. **Criação da Notificação com Role**

#### `notificationManager.ts` (linha 10):
```typescript
export const createArtistInviteNotification = async (
  inviteId: string,
  toUserId: string,
  fromUserId: string,
  artistId: string,
  role?: 'viewer' | 'editor' | 'admin' | 'owner' // ✅ Recebe role
) => {
  ...
  await createNotification({
    ...
    role: role || 'viewer', // ✅ Salva role na notificação
    type: 'artist_invite'
  });
}
```

#### `artistInviteService.ts` (linha 82):
```typescript
await createArtistInviteNotification(
  invite.id,
  data.toUserId,
  data.fromUserId,
  data.artistId,
  invite.role || data.role || 'viewer' // ✅ Passa a role
);
```

---

### 5. **Aceitar Convite com Role Correta**

#### `artistInviteService.ts` (linha 187):
```typescript
// Adicionar como colaborador com a ROLE DO CONVITE
const roleToUse = invite.role || 'viewer'; // ✅ Pega do convite

const { success, addError } = await addCollaboratorViaInvite(
  invite.artist_id, 
  { userId: invite.to_user_id, role: roleToUse } // ✅ Usa role do convite
);
```

---

### 6. **Notificações - Usar Role Diretamente**

#### `notificacoes.tsx` (linha 628):
```typescript
handleAcceptInviteFromNotification(
  notification.artist_id!,
  artistName,
  notification.id,
  notification.role // ✅ Passa role da notificação
);
```

#### Dentro da função (linha 272):
```typescript
const inviteRole = notificationRole || 'viewer'; // ✅ Usa role da notificação

// Define artista ativo com role correta
await setActiveArtist({
  id: artistId,
  name: artistName,
  role: inviteRole // ✅
});

// Traduz para mostrar no modal
const roleName = 
  inviteRole === 'admin' ? 'Administrador' :
  inviteRole === 'editor' ? 'Editor' :
  inviteRole === 'owner' ? 'Proprietário' :
  'Visualizador';
```

---

## 🔄 Fluxo Completo (Com Role)

### **Passo 1: Enviar Convite**
```
Admin abre "Colaboradores"
    ↓
Busca usuário: joao@email.com
    ↓
Seleciona role no dropdown: "Editor" ✅
    ↓
Clica em "Enviar Convite"
    ↓
INSERT INTO artist_invites (role='editor') ✅
    ↓
INSERT INTO notifications (role='editor') ✅
```

### **Passo 2: Receber Notificação**
```
João recebe notificação:
┌────────────────────────────────────┐
│ 📧 Novo Convite de Artista     🔵 │
│ Maria te convidou para...         │
│ Agora • por Maria Silva           │
│ ──────────────────────────────    │
│ ✅ Aceitar    ❌ Recusar          │
└────────────────────────────────────┘
```

### **Passo 3: Aceitar Convite**
```
João clica em "Aceitar"
    ↓
notification.role = 'editor' ✅
    ↓
Aceita convite
    ↓
INSERT INTO artist_members (
  user_id='joao_id',
  artist_id='banda_id',
  role='editor' ✅ ← USA ROLE DO CONVITE!
)
    ↓
DELETE FROM notifications ✅
    ↓
Modal mostra: "Cargo: Editor" ✅
```

---

## 📊 Comparação Antes vs Depois

### ❌ **ANTES (Problema):**
```
Admin convida como "Editor"
    ↓
Convite salvo SEM role
    ↓
Ao aceitar: SEMPRE adiciona como "viewer" ❌
```

### ✅ **DEPOIS (Correto):**
```
Admin convida como "Editor"
    ↓
Convite salvo COM role='editor' ✅
    ↓
Notificação criada COM role='editor' ✅
    ↓
Ao aceitar: adiciona como "editor" ✅
```

---

## 🗃️ Estrutura do Banco

### Tabela `artist_invites`:
```
id | artist_id | from_user_id | to_user_id | role    | status
---|-----------|--------------|------------|---------|--------
1  | abc-123   | user-admin   | user-joao  | editor  | pending
```

### Tabela `notifications`:
```
id | user_id   | artist_id | role    | type          | message
---|-----------|-----------|---------|---------------|------------------
1  | user-joao | abc-123   | editor  | artist_invite | Maria te convidou...
```

### Tabela `artist_members` (após aceitar):
```
id | user_id   | artist_id | role    | created_at
---|-----------|-----------|---------|------------
1  | user-joao | abc-123   | editor  | 2025-11-06  ✅
```

---

## 🚀 Execute o SQL Agora

No Supabase SQL Editor, execute:

**Arquivo:** `adicionar-role-notifications.sql`

Isso adiciona a coluna `role` na tabela `notifications`.

---

## 🧪 Teste Completo

### 1. Execute os SQLs
```sql
-- Já executado: adicionar role em artist_invites
-- Execute agora: adicionar-role-notifications.sql
```

### 2. Envie um Convite como Editor
1. Acesse "Colaboradores do Artista"
2. Adicione colaborador
3. **Selecione "Editor"** no dropdown
4. Envie convite

### 3. Verifique no Banco
```sql
-- Ver o convite criado
SELECT * FROM artist_invites 
WHERE status = 'pending' 
ORDER BY created_at DESC LIMIT 1;
-- role deve ser 'editor' ✅

-- Ver a notificação criada
SELECT * FROM notifications 
WHERE type = 'artist_invite' 
ORDER BY created_at DESC LIMIT 1;
-- role deve ser 'editor' ✅
```

### 4. Aceite o Convite
Login com o usuário convidado → Notificações → Aceitar

### 5. Verifique a Role Atribuída
```sql
SELECT 
  u.name,
  am.role,
  a.name as artist_name
FROM artist_members am
JOIN users u ON u.id = am.user_id
JOIN artists a ON a.id = am.artist_id
ORDER BY am.created_at DESC LIMIT 1;
-- role deve ser 'editor' ✅
```

---

## 📁 Arquivos Modificados

1. ✅ **adicionar-role-notifications.sql** - SQL para adicionar coluna
2. ✅ **services/supabase/notificationService.ts** - Interfaces e insert
3. ✅ **services/notificationManager.ts** - Recebe e passa role
4. ✅ **services/supabase/artistInviteService.ts** - Salva e usa role
5. ✅ **app/colaboradores-artista.tsx** - Passa role ao criar
6. ✅ **app/notificacoes.tsx** - Usa role da notificação

---

## ✨ Benefícios

1. ✅ **Performance**: Não precisa buscar convite para saber a role
2. ✅ **Simplicidade**: Role já vem na notificação
3. ✅ **Consistência**: Role é a mesma em 3 lugares (convite, notificação, member)
4. ✅ **UX melhor**: Modal mostra cargo correto imediatamente

---

**Execute o SQL e teste! Tudo pronto!** 🎉

