-- =====================================================
-- Trigger: mostrar "Evento deletado" quando ativo = false
-- =====================================================
-- Ao dar UPDATE com ativo = false (soft delete), a notificação
-- deve ser "Evento deletado" em vez de "Evento atualizado".
-- Rodar no SQL Editor do Supabase.

CREATE OR REPLACE FUNCTION notify_event_updated()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  editor_id uuid;
  target_artist_id uuid;
  notification_count integer;
  notif_title text;
  notif_message text;
BEGIN
  editor_id := NEW.created_by;
  target_artist_id := NEW.artist_id;

  IF editor_id IS NULL THEN
    RAISE NOTICE 'AVISO: created_by é NULL no evento %. Notificações não serão criadas.', NEW.id;
    RETURN NEW;
  END IF;

  -- Se ativo = false, é exclusão lógica (soft delete)
  IF (NEW.ativo IS NOT NULL AND NEW.ativo = false) THEN
    notif_title := 'Evento deletado';
    notif_message := 'Evento "' || NEW.name || '" foi deletado';
  ELSE
    notif_title := 'Evento atualizado';
    notif_message := 'Evento "' || NEW.name || '" foi atualizado';
  END IF;

  RAISE NOTICE 'Notificando - Editor: %, Artista: %, Evento: %, Título: %', editor_id, target_artist_id, NEW.id, notif_title;

  INSERT INTO notifications (
    to_user_id,
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
    notif_title,
    notif_message,
    'event',
    false
  FROM artist_members am
  WHERE am.artist_id = target_artist_id
    AND am.user_id != editor_id
    AND am.user_id IS NOT NULL
    AND editor_id IS NOT NULL;

  GET DIAGNOSTICS notification_count = ROW_COUNT;
  RAISE NOTICE 'Notificações inseridas: % (editor % excluído)', notification_count, editor_id;

  RETURN NEW;
END;
$$;

-- Garantir que o trigger existe
DROP TRIGGER IF EXISTS trg_notify_event_updated ON events;
CREATE TRIGGER trg_notify_event_updated
  AFTER UPDATE ON events
  FOR EACH ROW
  EXECUTE FUNCTION notify_event_updated();
