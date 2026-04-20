# 🧪 Teste de Permissões para Viewer

## ❌ Problema Identificado

**Viewer estava tendo acesso total ao app!**

### Causa:
No `contexts/PermissionsContext.tsx`, quando `userPermissions` era `null`, o código estava dando permissões completas:

```typescript
// ❌ ERRADO (antes)
const canCreateEvents = userPermissions ? userPermissions.permissions.canCreateEvents : true;
```

Isso significava que se houvesse qualquer erro ao carregar permissões, o usuário teria acesso total!

---

## ✅ Solução Aplicada

### Mudança no `PermissionsContext.tsx`:

```typescript
// ✅ CORRETO (agora)
const canCreateEvents = userPermissions?.permissions.canCreateEvents ?? false;
const canEditEvents = userPermissions?.permissions.canEditEvents ?? false;
const canDeleteEvents = userPermissions?.permissions.canDeleteEvents ?? false;
const canViewFinancials = userPermissions?.permissions.canViewFinancials ?? false;
const canManageMembers = userPermissions?.permissions.canManageMembers ?? false;
const canManageArtist = userPermissions?.permissions.canManageArtist ?? false;
const canDeleteArtist = userPermissions?.permissions.canDeleteArtist ?? false;
```

**Agora:** Se `userPermissions` for `null` ou `undefined` → **NEGA** todas as permissões (`false`)

---

## 🧪 Como Testar

### 1. Criar um Viewer de Teste

Execute no Supabase SQL Editor:

```sql
-- Verificar usuários existentes
SELECT id, name, email FROM users LIMIT 5;

-- Atribuir role "viewer" para um usuário de teste
-- Substitua USER_ID e ARTIST_ID pelos IDs reais
UPDATE artist_members 
SET role = 'viewer'
WHERE user_id = 'SEU_USER_ID_AQUI' 
AND artist_id = 'SEU_ARTIST_ID_AQUI';

-- Verificar se foi alterado
SELECT am.*, u.name as user_name, a.name as artist_name
FROM artist_members am
JOIN users u ON u.id = am.user_id
JOIN artists a ON a.id = am.artist_id
WHERE am.user_id = 'SEU_USER_ID_AQUI';
```

### 2. Fazer Login com o Viewer

1. Faça login com o usuário que tem role `viewer`
2. Acesse o app

### 3. Verificar Restrições

| Tela/Ação | Comportamento Esperado | ✅/❌ |
|-----------|------------------------|-------|
| **Agenda** | | |
| Visualizar eventos | ✅ Pode ver | |
| Botão "+" (criar evento) | Clica → Modal "Acesso Restrito" | |
| Clicar em evento | Modal "Acesso Restrito" | |
| **Financeiro** | | |
| Ver dados financeiros | ❌ Mensagem "Acesso Restrito" | |
| Valores aparecem | ❌ Todos em R$ 0,00 | |
| **Adicionar Evento** | | |
| Abrir tela direto | ❌ Alert e volta para agenda | |
| **Colaboradores** | | |
| Ver lista | ✅ Pode ver | |
| Adicionar colaborador | ❌ Botão não aparece | |
| Editar permissões | ❌ Botões não aparecem | |
| Remover colaborador | ❌ Botões não aparecem | |
| **Configurações** | | |
| Editar artista | ❌ Botão não aparece | |
| Ver artista | ✅ Pode ver nome/foto | |

---

## 🔍 Debug em Tempo Real

Para verificar se as permissões estão corretas, adicione temporariamente na tela de agenda:

```tsx
// DEBUG - Remover depois
console.log('🔍 Permissões atuais:', {
  isViewer,
  isEditor,
  isAdmin,
  isOwner,
  canCreateEvents,
  canEditEvents,
  canDeleteEvents,
  canViewFinancials,
  canManageMembers,
  userPermissions
});
```

**Resultado esperado para Viewer:**
```javascript
{
  isViewer: true,
  isEditor: false,
  isAdmin: false,
  isOwner: false,
  canCreateEvents: false,
  canEditEvents: false,
  canDeleteEvents: false,
  canViewFinancials: false,
  canManageMembers: false,
  userPermissions: {
    role: 'viewer',
    permissions: {
      canViewEvents: true,
      canViewFinancials: false,
      canCreateEvents: false,
      // ... todas false exceto canViewEvents
    }
  }
}
```

---

## ✅ Checklist de Segurança

- [x] PermissionsContext: `?? false` em todas as permissões
- [x] Financeiro: Bloqueia viewers
- [x] Agenda: Bloqueia criação de eventos para viewers
- [x] Adicionar Evento: Bloqueia viewers ao abrir
- [x] Colaboradores: Usa `canManage` para mostrar botões
- [x] Configurações: Usa `canManageArtist` para botão de editar

---

## 🔒 Matriz de Permissões

| Permissão | Viewer | Editor | Admin | Owner |
|-----------|--------|--------|-------|-------|
| Ver eventos | ✅ | ✅ | ✅ | ✅ |
| Ver finanças | ❌ | ✅ | ✅ | ✅ |
| Criar eventos | ❌ | ✅ | ✅ | ✅ |
| Editar eventos | ❌ | ✅ | ✅ | ✅ |
| Deletar eventos | ❌ | ❌ | ✅ | ✅ |
| Gerenciar membros | ❌ | ❌ | ✅ | ✅ |
| Editar artista | ❌ | ❌ | ✅ | ✅ |
| Deletar artista | ❌ | ❌ | ❌ | ✅ |

**Problema corrigido!** 🎉

