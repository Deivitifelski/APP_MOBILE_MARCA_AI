-- =====================================================
-- ADICIONAR COLUNA created_by NA TABELA EVENTS
-- =====================================================

-- 1. Verificar se a coluna created_by já existe
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_name = 'events'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Adicionar coluna created_by se não existir
-- Esta coluna armazena quem criou o evento (para o trigger)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'events' 
      AND column_name = 'created_by'
  ) THEN
    ALTER TABLE events 
      ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    
    RAISE NOTICE 'Coluna created_by adicionada com sucesso!';
  ELSE
    RAISE NOTICE 'Coluna created_by já existe.';
  END IF;
END $$;

-- 3. Preencher created_by com user_id para eventos existentes
-- (assumindo que user_id é quem criou originalmente)
UPDATE events 
SET created_by = user_id 
WHERE created_by IS NULL;

-- 4. Verificar resultado
SELECT 
  id,
  name,
  user_id,
  created_by,
  artist_id,
  event_date
FROM events
ORDER BY created_at DESC
LIMIT 10;

-- =====================================================
-- ALTERNATIVA: Se preferir manter apenas user_id
-- =====================================================

-- Se preferir usar user_id em vez de created_by, 
-- atualize o trigger para usar NEW.user_id em vez de NEW.created_by:

/*
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
  creator_id := NEW.user_id;  -- ✅ Mudança aqui: usar user_id em vez de created_by
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
    AND am.user_id != creator_id
    AND am.user_id IS NOT NULL;

  GET DIAGNOSTICS notification_count = ROW_COUNT;
  RAISE NOTICE 'Notificações inseridas: % (criador % excluído)', notification_count, creator_id;

  RETURN NEW;
END;
$$;
*/

