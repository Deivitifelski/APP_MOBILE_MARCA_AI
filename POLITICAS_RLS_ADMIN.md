# 🛡️ Políticas RLS para Gerenciamento de Colaboradores

## 📋 Regras de Permissão

### **ADMIN** 🛡️ (Poder Supremo)
- ✅ Pode alterar permissões de **TODOS** os colaboradores
- ✅ Pode **promover** usuários para admin
- ✅ Pode **rebaixar** outros admins
- ✅ Pode **alterar** owners
- ✅ Pode **remover** qualquer colaborador (owner, admin, editor, viewer)
- ❌ **NÃO pode**: Alterar/remover ele mesmo

### **OWNER** ⭐ (Poder Limitado)
- ✅ Pode alterar permissões de **Editor** e **Viewer**
- ✅ Pode remover **Editor** e **Viewer**
- ❌ **NÃO pode**: Alterar/remover Admin, Owner (outros), você mesmo
- ❌ **NÃO pode**: Promover usuários para admin

### **EDITOR/VIEWER** ✏️👁️
- ❌ Sem permissões de gerenciamento

---

## 🚀 Como Aplicar

Execute o arquivo **`politica-rls-admin-correto.sql`** no Supabase SQL Editor.

Este script:
1. ✅ Remove políticas antigas que bloqueiam admin
2. ✅ Cria novas políticas corretas
3. ✅ Permite admin promover para admin
4. ✅ Bloqueia owner de mexer em admin

---

## 🧪 Testes Sugeridos

Após aplicar as políticas, teste:

| Teste | Você é | Ação | Alvo | Resultado Esperado |
|-------|--------|------|------|-------------------|
| 1 | Admin | Promover para admin | Editor | ✅ Sucesso |
| 2 | Owner | Promover para admin | Editor | ❌ Falha |
| 3 | Admin | Alterar | Owner | ✅ Sucesso |
| 4 | Owner | Alterar | Admin | ❌ Falha |
| 5 | Admin | Remover | Admin (outro) | ✅ Sucesso |
| 6 | Owner | Remover | Admin | ❌ Falha |
| 7 | Admin | Alterar | Você mesmo | ❌ Falha |
| 8 | Owner | Alterar | Você mesmo | ❌ Falha |

---

## 📝 Validações em Camadas

### 1. **Interface (UI)** - `colaboradores-artista.tsx`
```typescript
// ADMIN: Mostra botões para todos (menos ele mesmo)
if (userRole === 'admin') {
  canChangeThisRole = true;
  canRemoveThis = true;
}

// OWNER: Mostra botões apenas para editor/viewer
else if (userRole === 'owner') {
  canChangeThisRole = item.role !== 'admin' && item.role !== 'owner';
  canRemoveThis = item.role !== 'admin' && item.role !== 'owner';
}
```

### 2. **Backend** - `collaboratorService.ts`
```typescript
// Valida antes de executar no banco
if (userRole === 'owner' && targetRole === 'admin') {
  return error;
}
```

### 3. **Banco de Dados** - Políticas RLS
```sql
-- Última camada de segurança
-- Mesmo que o código falhe, o banco bloqueia ações não autorizadas
```

---

## ⚠️ Importante

**Execute APENAS** o arquivo `politica-rls-admin-correto.sql` no Supabase.

As políticas antigas (`proteger-admin-rls.sql`) estavam **bloqueando admins** de fazer seu trabalho.

---

## 🎯 Resumo

**ANTES:**
- ❌ Admin bloqueado de alterar outros admins
- ❌ Admin bloqueado de promover para admin

**AGORA:**
- ✅ Admin pode fazer **TUDO** (exceto alterar a si mesmo)
- ✅ Owner tem limitações (não mexe em admin/owner)

