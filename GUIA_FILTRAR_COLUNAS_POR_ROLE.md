# 🔒 Guia: Filtrar Colunas por Role do Usuário

## 📋 Problema
Você quer que a coluna `value` (valor do evento) **não seja retornada** quando o usuário for **VIEWER**, mas seja retornada normalmente para **EDITOR/ADMIN/OWNER**.

---

## 🎯 3 Soluções Disponíveis

### ✅ **OPÇÃO 1: VIEW com CASE** (Simples)
**Arquivo:** `criar-view-eventos-por-role.sql`

#### Como Funciona:
1. Cria uma VIEW que faz CASE WHEN na coluna `value`
2. Se role = viewer → retorna NULL
3. Se role = editor/admin/owner → retorna valor real

#### Uso no Código:
```typescript
// ANTES
const { data } = await supabase
  .from('events')
  .select('*')
  .eq('artist_id', artistId);

// DEPOIS (usando VIEW)
const { data } = await supabase
  .from('events_with_role_permissions')  // ← VIEW
  .select('*')
  .eq('artist_id', artistId);
```

#### ✅ Vantagens:
- Simples de implementar
- Transparente (parece uma tabela normal)
- Boa performance
- Seguro (executa no banco)

#### ❌ Desvantagens:
- Menos flexível
- Não pode receber parâmetros complexos

---

### ✅ **OPÇÃO 2: FUNÇÃO RPC** (Recomendado) 🌟
**Arquivo:** `funcao-buscar-eventos-por-role.sql`

#### Como Funciona:
1. Cria uma função SQL que recebe `artist_id`
2. Verifica a role do usuário
3. Retorna eventos com `value` = NULL para viewer

#### Uso no Código:
```typescript
// services/supabase/eventService.ts

export const getEventsByArtistWithRole = async (artistId: string) => {
  const { data, error } = await supabase
    .rpc('get_events_by_role', { 
      p_artist_id: artistId 
    });

  // data já vem filtrada:
  // - viewer: { ...evento, value: null }
  // - outros: { ...evento, value: 1500.00 }
  
  return { events: data, error };
};
```

#### ✅ Vantagens:
- Muito flexível
- Pode ter lógica complexa
- Pode receber parâmetros
- Pode fazer validações
- Melhor controle
- Seguro (SECURITY DEFINER)

#### ❌ Desvantagens:
- Precisa usar `.rpc()` explicitamente
- Um pouco mais de código

---

### ✅ **OPÇÃO 3: Tabela Auxiliar** (Avançado)
**Arquivo:** `politicas-rls-colunas-por-role.sql`

#### Como Funciona:
1. Separa dados financeiros em tabela `event_financials`
2. Políticas RLS bloqueiam acesso para viewer
3. Só editor/admin/owner podem ver a tabela

#### ❌ Não Recomendado porque:
- Muito mais complexo
- Precisa mudar estrutura do banco
- Precisa fazer JOIN sempre
- Mais difícil de manter

---

## 🏆 Recomendação: Use FUNÇÃO RPC

### Por quê?
1. ✅ **Segurança garantida** - Roda no banco, não depende do código da app
2. ✅ **Flexível** - Fácil adicionar outras regras depois
3. ✅ **Performance** - Filtragem no banco é mais rápida
4. ✅ **Centralizado** - Uma única fonte da verdade
5. ✅ **Não quebra código existente** - Não precisa mudar estrutura

---

## 🚀 Implementação Passo a Passo (FUNÇÃO RPC)

### Passo 1: Executar SQL no Supabase
```sql
-- Execute o arquivo: funcao-buscar-eventos-por-role.sql
-- Isso cria as funções:
-- - get_events_by_role(p_artist_id UUID)
-- - get_event_by_id_with_role(p_event_id UUID)
```

### Passo 2: Atualizar eventService.ts

Adicione estas funções em `services/supabase/eventService.ts`:

```typescript
// Buscar eventos com filtragem por role
export const getEventsByArtistWithRole = async (artistId: string) => {
  try {
    const { data, error } = await supabase
      .rpc('get_events_by_role', { p_artist_id: artistId });

    if (error) {
      console.error('Erro ao buscar eventos:', error);
      return { events: null, error: error.message };
    }

    return { events: data, error: null };
  } catch (error) {
    return { events: null, error: 'Erro ao buscar eventos' };
  }
};

// Buscar um evento específico com filtragem
export const getEventByIdWithRole = async (eventId: string) => {
  try {
    const { data, error } = await supabase
      .rpc('get_event_by_id_with_role', { p_event_id: eventId });

    if (error) {
      return { event: null, error: error.message };
    }

    return { event: data?.[0] || null, error: null };
  } catch (error) {
    return { event: null, error: 'Erro ao buscar evento' };
  }
};
```

### Passo 3: Usar nas telas

```typescript
// app/(tabs)/agenda.tsx

const loadEvents = async () => {
  if (!activeArtist?.id) return;
  
  // Use a nova função que filtra por role
  const { events, error } = await getEventsByArtistWithRole(activeArtist.id);
  
  if (error) {
    console.error('Erro:', error);
    return;
  }
  
  // events já vem com value = null para viewers
  setEvents(events || []);
};
```

---

## 📊 Resultado Esperado

### Quando VIEWER acessa:
```json
{
  "id": "abc-123",
  "name": "Show em São Paulo",
  "event_date": "2025-11-15",
  "value": null,  // ← OCULTO
  "city": "São Paulo",
  "user_role": "viewer"
}
```

### Quando EDITOR/ADMIN/OWNER acessa:
```json
{
  "id": "abc-123",
  "name": "Show em São Paulo",
  "event_date": "2025-11-15",
  "value": 1500.00,  // ← VISÍVEL
  "city": "São Paulo",
  "user_role": "editor"
}
```

---

## 🔐 Outras Colunas que Você Pode Querer Filtrar

Na função SQL, você pode adicionar mais CASE WHEN para outras colunas:

```sql
-- Ocultar telefone do contratante para viewer
CASE 
  WHEN user_role_var IN ('editor', 'admin', 'owner') 
  THEN e.contractor_phone
  ELSE NULL  -- Viewer não vê
END AS contractor_phone,

-- Ocultar descrição completa para viewer
CASE 
  WHEN user_role_var IN ('editor', 'admin', 'owner') 
  THEN e.description
  ELSE SUBSTRING(e.description, 1, 100)  -- Viewer vê só 100 chars
END AS description,
```

---

## ⚠️ IMPORTANTE: Segurança em Camadas

Mesmo usando função RPC, **MANTENHA as políticas RLS** para segurança extra:
- RLS garante que usuário só veja eventos do artista dele
- Função RPC filtra colunas sensíveis baseado na role
- **Duas camadas de segurança = melhor proteção**

---

## 📝 Checklist de Implementação

- [ ] Executar `funcao-buscar-eventos-por-role.sql` no Supabase
- [ ] Testar função com: `SELECT * FROM get_events_by_role('seu-artist-id')`
- [ ] Adicionar funções no `eventService.ts`
- [ ] Atualizar telas para usar as novas funções
- [ ] Testar com usuário VIEWER
- [ ] Testar com usuário EDITOR
- [ ] Verificar que valor aparece/desaparece corretamente

---

**Pronto para implementar!** 🚀

Execute o arquivo `funcao-buscar-eventos-por-role.sql` no Supabase SQL Editor e comece a usar!

