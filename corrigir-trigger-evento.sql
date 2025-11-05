-- =====================================================
-- CORRIGIR TRIGGER DE NOTIFICAÇÃO DE EVENTOS
-- =====================================================

-- 1. Remover trigger antigo (se houver problemas)
DROP TRIGGER IF EXISTS notify_event_created_trigger ON events;
DROP TRIGGER IF EXISTS trg_notify_event_created ON events;

-- 2. Criar função melhorada com validações extras
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
  -- Obter IDs
  creator_id := NEW.created_by;
  target_artist_id := NEW.artist_id;

  -- ✅ VALIDAÇÃO: Se created_by for NULL, não criar notificações
  IF creator_id IS NULL THEN
    RAISE NOTICE 'AVISO: created_by é NULL no evento %. Notificações não serão criadas.', NEW.id;
    RETURN NEW;
  END IF;

  -- Debug
  RAISE NOTICE 'Criando notificações - Criador: %, Artista: %, Evento: %', creator_id, target_artist_id, NEW.id;

  -- ✅ Inserir notificações APENAS para membros que NÃO são o criador
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
    AND am.user_id != creator_id              -- ✅ Excluir criador
    AND am.user_id IS NOT NULL                -- ✅ Garantir que user_id não é NULL
    AND creator_id IS NOT NULL;               -- ✅ Garantir que creator_id não é NULL

  GET DIAGNOSTICS notification_count = ROW_COUNT;
  RAISE NOTICE 'Notificações de evento criado inseridas: % (criador % excluído)', notification_count, creator_id;

  RETURN NEW;
END;
$$;

-- 3. Criar trigger
DROP TRIGGER IF EXISTS trg_notify_event_created ON events;
CREATE TRIGGER trg_notify_event_created
  AFTER INSERT ON events
  FOR EACH ROW
  EXECUTE FUNCTION notify_event_created();

-- =====================================================
-- TRIGGER PARA EVENTO ATUALIZADO
-- =====================================================

-- 4. Criar função para notificar quando evento é atualizado
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
  -- Obter IDs
  editor_id := NEW.created_by;  -- Quem editou (usando created_by como referência)
  target_artist_id := NEW.artist_id;

  -- ✅ VALIDAÇÃO: Se created_by for NULL, não criar notificações
  IF editor_id IS NULL THEN
    RAISE NOTICE 'AVISO: created_by é NULL no evento %. Notificações não serão criadas.', NEW.id;
    RETURN NEW;
  END IF;

  -- Debug
  RAISE NOTICE 'Notificando sobre atualização - Editor: %, Artista: %, Evento: %', editor_id, target_artist_id, NEW.id;

  -- ✅ Inserir notificações APENAS para membros que NÃO são quem editou
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
    AND am.user_id IS NOT NULL
    AND editor_id IS NOT NULL;

  GET DIAGNOSTICS notification_count = ROW_COUNT;
  RAISE NOTICE 'Notificações de evento atualizado inseridas: % (editor % excluído)', notification_count, editor_id;

  RETURN NEW;
END;
$$;

-- 5. Criar trigger de atualização
DROP TRIGGER IF EXISTS trg_notify_event_updated ON events;
CREATE TRIGGER trg_notify_event_updated
  AFTER UPDATE ON events
  FOR EACH ROW
  WHEN (OLD.* IS DISTINCT FROM NEW.*)  -- Só dispara se houver mudança real
  EXECUTE FUNCTION notify_event_updated();

-- =====================================================
-- TESTAR
-- =====================================================

-- 6. Após executar, teste criando um evento e verifique os logs:
-- Os logs devem mostrar algo como:
-- NOTICE: Criando notificações - Criador: xxx, Artista: yyy, Evento: zzz
-- NOTICE: Notificações de evento criado inseridas: 3 (criador xxx excluído)

