# 🔧 Corrigir Notificações de Eventos

## ⚠️ Problema Identificado

Quando um usuário cria ou edita um evento, **ele mesmo está recebendo notificação** do próprio evento.

**Causa raiz:** A coluna `created_by` não existe na tabela `events` (só existe `user_id`), então o trigger `notify_event_created()` não consegue identificar quem criou o evento para excluí-lo das notificações.

## 🎯 Solução (Escolha UMA das opções)

### OPÇÃO 1: Adicionar Coluna created_by (Recomendado) ⭐

**Vantagem:** Mantém o trigger funcionando e separa quem criou (created_by) de quem é dono (user_id)

Execute no **Supabase SQL Editor**:

```sql
-- 1. Adicionar coluna created_by
ALTER TABLE events 
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- 2. Preencher created_by com user_id para eventos existentes
UPDATE events 
SET created_by = user_id 
WHERE created_by IS NULL;

-- 3. Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_events_created_by ON events(created_by);
```

Depois execute o arquivo `corrigir-trigger-evento.sql` para atualizar o trigger com validações extras.

---

### OPÇÃO 2: Usar user_id no Trigger (Mais Simples) ⚡

**Vantagem:** Não precisa adicionar coluna nova

Execute no **Supabase SQL Editor**:

```sql
-- Atualizar trigger para usar user_id em vez de created_by
CREATE OR REPLACE FUNCTION notify_event_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  creator_id uuid;
  target_artist_id uuid;
  notification_count integer;
BEGIN
  creator_id := NEW.user_id;  -- ✅ Usar user_id em vez de created_by
  target_artist_id := NEW.artist_id;

  IF creator_id IS NULL THEN
    RAISE NOTICE 'AVISO: user_id é NULL no evento %. Notificações não serão criadas.', NEW.id;
    RETURN NEW;
  END IF;

  RAISE NOTICE 'Criando notificações - Criador: %, Artista: %, Evento: %', creator_id, target_artist_id, NEW.id;

  INSERT INTO notifications (
    user_id,
    from_user_id,
    artist_id,
    event_id,
    title,
    message,
    type,
    read
  )
  SELECT 
    am.user_id,
    creator_id,
    target_artist_id,
    NEW.id,
    'Novo evento adicionado',
    'Evento "' || NEW.name || '" marcado para ' || to_char(NEW.event_date, 'DD/MM/YYYY'),
    'event_created',
    false
  FROM artist_members am
  WHERE am.artist_id = target_artist_id
    AND am.user_id != creator_id        -- ✅ Excluir criador
    AND am.user_id IS NOT NULL;

  GET DIAGNOSTICS notification_count = ROW_COUNT;
  RAISE NOTICE 'Notificações inseridas: % (criador % excluído)', notification_count, creator_id;

  RETURN NEW;
END;
$$;
```

E atualizar o código TypeScript:

```typescript
// No eventService.ts, mudar de:
created_by: eventData.user_id,

// Para:
user_id: eventData.user_id,
```

---

## 🧪 Verificação e Debug

Execute este SQL para verificar se o problema é a falta da coluna `created_by`:

```sql
-- Verificar colunas da tabela events
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'events'
ORDER BY ordinal_position;
```

Se **não aparecer** a coluna `created_by`, use a **Opção 1** acima.

---

## ✅ Teste Final

Após aplicar a solução:

1. **Criar um evento teste** no app
2. **Abrir a tela de notificações**
3. **Verificar**:
   - ✅ Outros colaboradores receberam notificação
   - ❌ Você (criador) **NÃO** recebeu

---

## 📊 Scripts de Debug Criados

Use estes scripts no SQL Editor para investigar:

1. **`adicionar-coluna-created-by.sql`** - Adiciona coluna created_by (Opção 1)
2. **`corrigir-trigger-evento.sql`** - Trigger melhorado com validações
3. **`debugar-trigger-notificacao.sql`** - Verificar quem recebeu notificações
4. **`verificar-automacoes-supabase.sql`** - Listar todos triggers e functions

---

## 💡 Por Que Aconteceu?

O trigger `notify_event_created()` estava usando `NEW.created_by`, mas a coluna não existia na tabela (retornava NULL), então a condição `am.user_id != creator_id` comparava com NULL e não funcionava corretamente.

---

## 🚀 Recomendação

**Use a OPÇÃO 2** (mais simples):
1. Atualize o trigger para usar `NEW.user_id`
2. Não precisa adicionar coluna nova
3. Solução rápida e eficaz

