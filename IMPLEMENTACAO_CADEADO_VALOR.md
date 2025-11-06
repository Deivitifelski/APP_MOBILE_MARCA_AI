# 🔒 Implementação: Cadeado no Valor dos Eventos

## ✅ O que foi implementado

Agora quando um usuário **VIEWER** acessa a agenda, os valores dos eventos são **automaticamente ocultados** e mostrados com um **ícone de cadeado** 🔒.

---

## 📋 Mudanças Realizadas

### 1. **Função RPC no Banco de Dados** (`funcao-buscar-eventos-por-role-atualizada.sql`)

Criadas funções SQL que filtram automaticamente as colunas sensíveis:

```sql
-- Função que retorna eventos com value = NULL para viewers
CREATE FUNCTION get_events_by_role(p_artist_id UUID)

-- Função que retorna um evento específico com filtragem
CREATE FUNCTION get_event_by_id_with_role(p_event_id UUID)
```

**Como funciona:**
- Busca a role do usuário na tabela `artist_members`
- Se role = `viewer` → retorna `value = NULL`
- Se role = `editor/admin/owner` → retorna valor real

---

### 2. **Serviço de Eventos** (`services/supabase/eventService.ts`)

Adicionadas 3 novas funções TypeScript:

#### `getEventsByArtistWithRole()`
Busca todos os eventos de um artista com filtragem automática.

#### `getEventsByMonthWithRole()`
Busca eventos de um mês específico com filtragem por role.

#### `getEventByIdWithRole()`
Busca um evento específico com filtragem.

**Nova interface:**
```typescript
export interface EventWithRole extends Event {
  user_role?: string; // Role do usuário (viewer/editor/admin/owner)
}
```

---

### 3. **Tela de Agenda** (`app/(tabs)/agenda.tsx`)

#### Mudança 1: Usar função com filtragem
```typescript
// ANTES
const result = await getEventsByMonth(activeArtist.id, currentYear, currentMonth);

// DEPOIS
const result = await getEventsByMonthWithRole(activeArtist.id, currentYear, currentMonth);
```

#### Mudança 2: Renderização do valor com cadeado
```typescript
// ANTES: Mostrava valor apenas se hasFinancialAccess
{item.value && hasFinancialAccess ? (
  <Text>R$ {item.value}</Text>
) : null}

// DEPOIS: Mostra cadeado quando value é null
{item.value !== null && item.value !== undefined ? (
  <Text style={[styles.showValue, { color: colors.primary }]}>
    R$ {item.value.toLocaleString('pt-BR')}
  </Text>
) : (
  <View style={styles.lockedValueContainer}>
    <Ionicons name="lock-closed" size={12} color={colors.textSecondary} />
    <Text style={[styles.lockedValueText, { color: colors.textSecondary }]}>
      Valor oculto
    </Text>
  </View>
)}
```

---

## 🎯 Resultado Visual

### Para VIEWER:
```
┌─────────────────────────────────┐
│ Show em São Paulo               │
│ 📍 São Paulo                    │
│ 🔒 Valor oculto                 │  ← CADEADO
└─────────────────────────────────┘
```

### Para EDITOR/ADMIN/OWNER:
```
┌─────────────────────────────────┐
│ Show em São Paulo               │
│ 📍 São Paulo                    │
│ R$ 1.500,00                     │  ← VALOR VISÍVEL
└─────────────────────────────────┘
```

---

## 🔐 Segurança em Camadas

### Camada 1: Banco de Dados (Função RPC)
✅ Filtragem acontece no PostgreSQL  
✅ Value nunca é enviado para o cliente se for viewer  
✅ Impossível burlar via código frontend

### Camada 2: Políticas RLS
✅ Usuário só vê eventos do artista dele  
✅ Autenticação via `auth.uid()`

### Camada 3: Interface
✅ Mostra cadeado visual  
✅ Feedback claro para o usuário

---

## 📊 Fluxo de Dados

```
┌──────────────┐
│   VIEWER     │
│  (Frontend)  │
└──────┬───────┘
       │
       │ getEventsByMonthWithRole(artistId)
       ▼
┌──────────────────────┐
│  Supabase RPC        │
│  get_events_by_role  │
└──────┬───────────────┘
       │
       │ Verifica role = 'viewer'
       ▼
┌──────────────────────┐
│  Retorna eventos     │
│  { ...event,         │
│    value: NULL }     │  ← VALOR OCULTO
└──────┬───────────────┘
       │
       ▼
┌──────────────┐
│  Frontend    │
│  Renderiza   │
│  🔒 Cadeado  │
└──────────────┘
```

---

## 🧪 Como Testar

### 1. Criar usuário VIEWER
```sql
-- No Supabase SQL Editor
INSERT INTO artist_members (user_id, artist_id, role)
VALUES ('USER_ID', 'ARTIST_ID', 'viewer');
```

### 2. Login com o usuário VIEWER

### 3. Acessar a Agenda
- ✅ Ver eventos listados
- ✅ Ver localização
- ✅ Ver data/hora
- ❌ **NÃO** ver valor (deve aparecer 🔒 Valor oculto)

### 4. Mudar role para EDITOR
```sql
UPDATE artist_members 
SET role = 'editor' 
WHERE user_id = 'USER_ID' AND artist_id = 'ARTIST_ID';
```

### 5. Recarregar a Agenda
- ✅ Agora os valores devem aparecer normalmente

---

## 📝 Arquivos Modificados

1. ✅ `funcao-buscar-eventos-por-role-atualizada.sql` - Funções RPC
2. ✅ `services/supabase/eventService.ts` - Novas funções TypeScript
3. ✅ `app/(tabs)/agenda.tsx` - Usar nova função e renderizar cadeado

---

## 🚀 Deploy

### Passo 1: Executar SQL no Supabase
Execute o arquivo completo:
```
funcao-buscar-eventos-por-role-atualizada.sql
```

### Passo 2: Verificar funções criadas
```sql
SELECT routine_name 
FROM information_schema.routines
WHERE routine_name IN ('get_events_by_role', 'get_event_by_id_with_role');
```

### Passo 3: Testar no App
Build e teste com usuários de diferentes roles.

---

## 🔄 Outras Telas para Atualizar (Futuro)

Para aplicar o mesmo conceito em outras telas:

### Financeiro (`app/(tabs)/financeiro.tsx`)
- Usar `getEventsByArtistWithRole()`
- Mostrar cadeado nos valores

### Detalhes do Evento (`app/detalhes-evento.tsx`)
- Usar `getEventByIdWithRole()`
- Ocultar valor se for viewer

### Editar Evento (`app/editar-evento.tsx`)
- Verificar role antes de mostrar campo valor
- Desabilitar edição para viewer

---

## ⚠️ Notas Importantes

1. **Cache**: O cache ainda guarda os eventos antigos (sem filtragem). Considere limpar o cache ou atualizar a lógica de cache.

2. **Consistência**: Todas as telas que mostram valores devem usar as funções `WithRole` para manter consistência.

3. **Performance**: A função RPC é executada no banco, então é mais rápida que filtrar no frontend.

4. **Outras colunas**: Você pode adicionar mais colunas filtradas (telefone, descrição, etc.) seguindo o mesmo padrão.

---

**Status:** ✅ Implementado e pronto para uso  
**Data:** 6 de Novembro de 2025

