# 🔐 Sistema de Permissões Baseado em Roles

## 📋 Visão Geral

O sistema de permissões implementa um controle de acesso granular baseado em roles para diferentes níveis de usuários em artistas.

## 🎭 Roles Disponíveis

### 👁️ **VIEWER** (Visualizador)
- ✅ **Pode:** Visualizar eventos básicos (sem valores financeiros)
- ❌ **Não pode:** Criar, editar, deletar eventos ou gerenciar membros

### ✏️ **EDITOR** (Editor)
- ✅ **Pode:** Visualizar eventos completos, criar e editar eventos
- ❌ **Não pode:** Deletar eventos ou gerenciar membros

### 👑 **ADMIN** (Administrador)
- ✅ **Pode:** Tudo que o editor pode + deletar eventos + gerenciar membros + gerenciar artista
- ❌ **Não pode:** Deletar o artista

### 🏆 **OWNER** (Proprietário)
- ✅ **Pode:** Tudo (acesso total)

## 🏗️ Arquitetura

### 1. **Serviço de Permissões** (`permissionsService.ts`)
```typescript
// Verificar permissão específica
const canEdit = await hasPermission(userId, artistId, 'canEditEvents');

// Obter todas as permissões do usuário
const permissions = await getUserPermissions(userId, artistId);
```

### 2. **Políticas RLS no Supabase**
- **Row Level Security** habilitado em todas as tabelas sensíveis
- **Funções auxiliares** para verificação de roles
- **Views filtradas** por role

### 3. **Serviços com Verificação**
- `getEventsWithPermissions()` - Busca eventos baseado no role
- `createEventWithPermissions()` - Cria evento com verificação
- `updateEventWithPermissions()` - Atualiza evento com verificação
- `deleteEventWithPermissions()` - Deleta evento com verificação

## 🚀 Como Usar

### **1. Aplicar Políticas RLS**
```sql
-- Execute o arquivo supabase-permissions.sql no Supabase
-- Isso criará todas as políticas e funções necessárias
```

### **2. Usar nos Serviços**
```typescript
// ❌ Antes (sem permissões)
const events = await getEvents(artistId);

// ✅ Agora (com permissões)
const events = await getEventsWithPermissions(artistId, userId);
```

### **3. Verificar Permissões na UI**
```typescript
const permissions = await getUserPermissions(userId, artistId);

if (permissions?.permissions.canEditEvents) {
  // Mostrar botão de editar
}
```

## 📊 Cache de Permissões

O sistema implementa cache para evitar múltiplas consultas:

```typescript
// Cache automático
const permissions = await getUserPermissions(userId, artistId); // Primeira consulta
const permissions2 = await getUserPermissions(userId, artistId); // Usa cache

// Limpar cache quando necessário
clearPermissionsCache(userId, artistId);
```

## 🔒 Segurança

### **Nível de Banco (RLS)**
- Todas as consultas são filtradas automaticamente
- Impossível acessar dados sem permissão
- Funções auxiliares para verificação de roles

### **Nível de Aplicação**
- Verificação dupla de permissões
- Cache seguro de permissões
- Validação de operações sensíveis

## 📝 Exemplos Práticos

### **Viewer vendo eventos:**
```typescript
// Retorna eventos sem valores financeiros
const events = await getEventsWithPermissions(artistId, viewerUserId);
// events[0].value = undefined (oculto)
```

### **Editor criando evento:**
```typescript
const result = await createEventWithPermissions(eventData, editorUserId);
if (!result.success) {
  // "Sem permissão para criar eventos"
}
```

### **Admin gerenciando membros:**
```typescript
const members = await getArtistMembers(artistId, adminUserId);
// Retorna lista de membros
```

## 🎯 Benefícios

1. **Performance:** Cache evita múltiplas consultas
2. **Segurança:** RLS + verificação dupla
3. **Flexibilidade:** Roles configuráveis
4. **Escalabilidade:** Sistema preparado para crescimento
5. **Manutenibilidade:** Código centralizado e organizado

## 🔧 Configuração

### **1. Executar SQL no Supabase:**
```bash
# Execute o arquivo supabase-permissions.sql
```

### **2. Atualizar Serviços:**
```typescript
// Substituir chamadas antigas pelas novas com permissões
import { getEventsWithPermissions } from './eventService';
```

### **3. Testar Permissões:**
```typescript
// Verificar se as permissões estão funcionando
const canEdit = await hasPermission(userId, artistId, 'canEditEvents');
console.log('Pode editar:', canEdit);
```

## 📚 Arquivos Criados

- `permissionsService.ts` - Serviço principal de permissões
- `artistMembersService.ts` - Gerenciamento de membros
- `supabase-permissions.sql` - Políticas RLS e funções
- `PERMISSIONS_GUIDE.md` - Esta documentação

## 🚨 Importante

- **Sempre** use as funções com `WithPermissions` nos serviços
- **Execute** o SQL no Supabase antes de usar
- **Teste** as permissões em diferentes roles
- **Limpe** o cache quando necessário
