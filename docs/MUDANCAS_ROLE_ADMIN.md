# 📋 Mudanças no Sistema de Roles - Admin como Criador

## ✅ Alterações Realizadas

### 1. **Criação de Artista** (`services/supabase/artistService.ts`)
**ANTES:** Criador era definido como `owner`
**AGORA:** Criador é sempre **`admin`**

```typescript
// Linha 37-46
role: 'admin', // Criador sempre é admin
```

---

### 2. **Tela de Cadastro de Artista** (`app/screens/profile/ArtistProfileScreen.tsx`)
**ANTES:** Perguntava se queria mudar para novo artista e definia como `owner`
**AGORA:** 
- ✅ Muda automaticamente para o novo artista criado
- ✅ Define role como **`admin`**
- ✅ Mostra mensagem de sucesso confirmando a mudança

```typescript
// Linhas 152-168
await setActiveArtist({
  id: artist.id,
  name: artist.name,
  role: 'admin' // Criador sempre é admin
});
```

---

### 3. **Permissão para Criar Eventos** (`app/(tabs)/agenda.tsx`)
**ANTES:** Apenas `owner` e `editor` podiam criar eventos
**AGORA:** Apenas **`admin`** e `editor` podem criar eventos

```typescript
// Linha 290-292
// ✅ Verificar se pode criar eventos (admin e editor)
const allowedRoles = ['admin', 'editor'];
const canCreate = currentUserRole && allowedRoles.includes(currentUserRole);
```

---

### 4. **Permissões do Sistema** (`services/supabase/permissionsService.ts`)
**ANTES:** Admin não podia deletar artista
**AGORA:** **Admin pode deletar artista**

```typescript
// Linhas 104-114
case 'admin':
  return {
    canViewEvents: true,
    canViewFinancials: true,
    canCreateEvents: true,        // ✅ CRIAR
    canEditEvents: true,          // ✅ EDITAR
    canDeleteEvents: true,        // ✅ DELETAR
    canManageMembers: true,       // ✅ GERENCIAR MEMBROS
    canManageArtist: true,        // ✅ GERENCIAR ARTISTA
    canDeleteArtist: true,        // ✅ DELETAR ARTISTA
  };
```

---

### 5. **Ordem de Deleção de Artista** (`services/supabase/artistService.ts`)
**ANTES:** Deletava `artist_members` antes do artista (causava erro RLS)
**AGORA:** Deleta o **artista ANTES** dos membros

```typescript
// Linhas 225-256
// 5️⃣ Deletar o ARTISTA (antes dos membros)
// 6️⃣ Deletar colaboradores (depois do artista)
```

**MOTIVO:** A política RLS verifica se o usuário é admin consultando `artist_members`. Se deletarmos os membros primeiro, a verificação falha.

---

## 🎯 Resumo das Permissões

### **ADMIN** (Criador do Artista)
- ✅ Visualizar eventos
- ✅ Visualizar financeiro
- ✅ **Criar eventos**
- ✅ Editar eventos
- ✅ Deletar eventos
- ✅ Gerenciar membros (adicionar/remover colaboradores)
- ✅ Gerenciar artista (editar perfil)
- ✅ **Deletar artista**

### **EDITOR**
- ✅ Visualizar eventos
- ✅ Visualizar financeiro
- ✅ **Criar eventos**
- ✅ Editar eventos
- ❌ Deletar eventos
- ❌ Gerenciar membros
- ❌ Gerenciar artista
- ❌ Deletar artista

### **VIEWER**
- ✅ Visualizar eventos (sem ver valores financeiros)
- ❌ Tudo o resto

---

## 📝 Arquivo SQL para Atualizar Políticas RLS

Execute o arquivo `verificar-politicas-admin-eventos.sql` no Supabase SQL Editor para garantir que as políticas do banco de dados estejam corretas.

---

## 🔄 Fluxo Atual de Criação de Artista

1. Usuário preenche formulário de cadastro
2. Artista é criado no banco
3. Usuário é adicionado como **ADMIN** do artista
4. Sistema **muda automaticamente** para o novo artista
5. Usuário é redirecionado para a agenda
6. Usuário já pode criar eventos imediatamente

---

## ⚠️ Nota sobre OWNER

O role `owner` ainda existe no sistema para retrocompatibilidade, mas **novos artistas não terão owners** - apenas admins.

Se você quiser remover completamente o conceito de `owner` do sistema, será necessário:
1. Migrar todos os `owner` existentes para `admin` no banco
2. Remover referências ao role `owner` no código
3. Atualizar as políticas RLS

---

**Data:** 6 de Novembro de 2025
**Status:** ✅ Implementado e testado

