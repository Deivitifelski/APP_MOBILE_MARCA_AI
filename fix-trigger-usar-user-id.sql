-- =====================================================
-- SOLUÇÃO RÁPIDA: Atualizar Trigger para Usar user_id
-- =====================================================

-- Este script corrige o trigger para usar user_id em vez de created_by
-- Execute no SQL Editor do Supabase

-- 1. Atualizar função para usar user_id
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
  -- ✅ CORREÇÃO: Usar NEW.user_id em vez de NEW.created_by
  creator_id := NEW.user_id;
  target_artist_id := NEW.artist_id;

  -- Validação
  IF creator_id IS NULL THEN
    RAISE NOTICE 'AVISO: user_id é NULL no evento %. Notificações não serão criadas.', NEW.id;
    RETURN NEW;
  END IF;

  -- Debug
  RAISE NOTICE 'Evento criado - ID: %, Nome: %, Criador: %, Artista: %', 
    NEW.id, NEW.name, creator_id, target_artist_id;

  -- Inserir notificações para todos os membros EXCETO o criador
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
    AND am.user_id != creator_id              -- ✅ Excluir o criador
    AND am.user_id IS NOT NULL;

  GET DIAGNOSTICS notification_count = ROW_COUNT;
  RAISE NOTICE 'Notificações inseridas: % (criador % foi EXCLUÍDO)', notification_count, creator_id;

  RETURN NEW;
END;
$$;

-- 2. Recriar trigger (caso precise)
DROP TRIGGER IF EXISTS trg_notify_event_created ON events;
CREATE TRIGGER trg_notify_event_created
  AFTER INSERT ON events
  FOR EACH ROW
  EXECUTE FUNCTION notify_event_created();

-- =====================================================
-- TRIGGER PARA EVENTO ATUALIZADO (OPCIONAL)
-- =====================================================

-- 3. Criar trigger para quando evento for editado
CREATE OR REPLACE FUNCTION notify_event_updated()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  editor_id uuid;
  target_artist_id uuid;
  notification_count integer;
BEGIN
  editor_id := NEW.user_id;  -- ✅ Quem editou (assumindo que user_id não muda)
  target_artist_id := NEW.artist_id;

  IF editor_id IS NULL THEN
    RETURN NEW;
  END IF;

  RAISE NOTICE 'Evento atualizado - ID: %, Nome: %, Editor: %, Artista: %', 
    NEW.id, NEW.name, editor_id, target_artist_id;

  -- Notificar apenas quem NÃO editou
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
    editor_id,
    target_artist_id,
    NEW.id,
    'Evento atualizado',
    'Evento "' || NEW.name || '" foi atualizado',
    'event_updated',
    false
  FROM artist_members am
  WHERE am.artist_id = target_artist_id
    AND am.user_id != editor_id              -- ✅ Excluir quem editou
    AND am.user_id IS NOT NULL;

  GET DIAGNOSTICS notification_count = ROW_COUNT;
  RAISE NOTICE 'Notificações de atualização inseridas: % (editor % foi EXCLUÍDO)', notification_count, editor_id;

  RETURN NEW;
END;
$$;

-- 4. Criar trigger de atualização
DROP TRIGGER IF EXISTS trg_notify_event_updated ON events;
CREATE TRIGGER trg_notify_event_updated
  AFTER UPDATE ON events
  FOR EACH ROW
  WHEN (OLD.* IS DISTINCT FROM NEW.*)  -- Só dispara se houver mudança real
  EXECUTE FUNCTION notify_event_updated();

-- =====================================================
-- TESTE
-- =====================================================

-- 5. Após executar, crie um evento pelo app e verifique:
-- Os logs (NOTICE) devem aparecer no Supabase Logs mostrando quantas notificações foram criadas
-- e confirmando que o criador foi excluído

