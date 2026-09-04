-- Feed de datas: reutiliza `events` + `convite_participacao_evento`.
-- Não cria tabela nova. Cole TODO este arquivo no SQL Editor do Supabase e rode.
--
-- feed_tipo:
--   'disponivel' = Oferta (oferece artista, banda, músico, serviço, parceria)
--   'demanda'    = Procurando (busca artista, músico, banda, serviço, parceria)
--   NULL         = evento normal da agenda (não entra no feed)
--
-- O cachê fica em events.value e NÃO é devolvido na listagem pública.
-- Só aparece ao iniciar a negociação (convite_participacao_evento.cache_valor).
--
-- Sem BEGIN/COMMIT único: se um trecho falhar, a busca do feed ainda é criada.

CREATE OR REPLACE FUNCTION public.normalize_pt_search(input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT translate(
    lower(trim(coalesce(input, ''))),
    'áàãâäéèêëíìîïóòõôöúùûüçñÁÀÃÂÄÉÈÊËÍÌÎÏÓÒÕÔÖÚÙÛÜÇÑ',
    'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN'
  );
$$;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS feed_tipo TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'events_feed_tipo_check'
  ) THEN
    ALTER TABLE public.events
      ADD CONSTRAINT events_feed_tipo_check
      CHECK (feed_tipo IS NULL OR feed_tipo IN ('disponivel', 'demanda'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_events_feed_publico
  ON public.events (event_date, feed_tipo)
  WHERE feed_tipo IS NOT NULL AND COALESCE(ativo, true);

COMMENT ON COLUMN public.events.feed_tipo IS
  'Anúncio do feed: disponivel (oferece data) ou demanda (precisa de artista). NULL = agenda normal.';

-- Agenda/financeiro ignoram anúncios do feed
-- DROP obrigatório: CREATE OR REPLACE não troca corpo se o tipo de retorno já existir
-- com a mesma assinatura, mas falha se a assinatura no banco for outra.
DROP FUNCTION IF EXISTS public.get_events_by_role(uuid);

CREATE FUNCTION public.get_events_by_role(p_artist_id UUID)
RETURNS TABLE (
  id UUID,
  artist_id UUID,
  created_by UUID,
  name TEXT,
  description TEXT,
  event_date DATE,
  start_time TIME,
  end_time TIME,
  value NUMERIC,
  city TEXT,
  state_uf TEXT,
  contractor_phone TEXT,
  confirmed BOOLEAN,
  tag TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  user_role TEXT,
  viewer_description TEXT
) AS $$
DECLARE
  user_role_var TEXT;
BEGIN
  SELECT am.role INTO user_role_var
  FROM artist_members am
  WHERE am.user_id = auth.uid()
    AND am.artist_id = p_artist_id;

  IF user_role_var IS NULL THEN
    RAISE EXCEPTION 'Usuário não tem acesso a este artista';
  END IF;

  RETURN QUERY
  SELECT
    e.id,
    e.artist_id,
    e.created_by,
    e.name,
    e.description,
    e.event_date,
    e.start_time,
    e.end_time,
    CASE
      WHEN user_role_var IN ('admin', 'owner') THEN e.value
      WHEN user_role_var = 'vendedor' AND e.created_by = auth.uid() THEN e.value
      ELSE NULL
    END AS value,
    e.city,
    e.state_uf,
    e.contractor_phone,
    e.confirmed,
    e.tag,
    e.created_at::timestamptz,
    e.updated_at::timestamptz,
    user_role_var AS user_role,
    e.viewer_description
  FROM events e
  WHERE e.artist_id = p_artist_id
    AND e.ativo IS TRUE
    AND e.feed_tipo IS NULL
  ORDER BY e.event_date DESC, e.start_time DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_events_by_role(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_events_by_role(UUID) TO service_role;

-- Anúncios do feed não disparam "evento atualizado/deletado" da agenda
CREATE OR REPLACE FUNCTION public.notify_event_updated()
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
  IF TG_OP = 'UPDATE' AND OLD.feed_tipo IS NOT NULL THEN
    RETURN NEW;
  END IF;

  editor_id := COALESCE(NEW.updated_by, NEW.created_by);
  target_artist_id := NEW.artist_id;

  IF editor_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF (NEW.ativo IS NOT NULL AND NEW.ativo = false) THEN
    notif_title := 'Evento deletado';
    notif_message := 'Evento "' || NEW.name || '" foi deletado';
  ELSE
    notif_title := 'Evento atualizado';
    notif_message := 'Evento "' || NEW.name || '" foi atualizado';
  END IF;

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

  RETURN NEW;
END;
$$;

-- =====================================================
-- Listagem pública (sem cachê, sem telefone)
-- =====================================================
DROP FUNCTION IF EXISTS public.listar_feed_marketplace(text, text, text, uuid);

CREATE OR REPLACE FUNCTION public.listar_feed_marketplace(
  p_tipo TEXT DEFAULT NULL,
  p_estado TEXT DEFAULT NULL,
  p_cidade TEXT DEFAULT NULL,
  p_artista_atual_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  artist_id UUID,
  artist_name TEXT,
  artist_image TEXT,
  musical_style TEXT,
  feed_tipo TEXT,
  event_date DATE,
  start_time TIME,
  end_time TIME,
  city TEXT,
  state_uf TEXT,
  description TEXT,
  created_at TIMESTAMPTZ,
  is_mine BOOLEAN,
  meu_cache_valor NUMERIC,
  tem_cache BOOLEAN
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    e.id,
    e.artist_id,
    a.name,
    COALESCE(
      NULLIF(trim(COALESCE(a.profile_url, '')), ''),
      NULL
    ),
    a.musical_style,
    e.feed_tipo,
    e.event_date,
    e.start_time,
    e.end_time,
    NULLIF(trim(COALESCE(e.city, '')), ''),
    CASE
      WHEN e.state_uf IS NULL OR trim(e.state_uf) = '' THEN NULL
      ELSE upper(trim(e.state_uf))
    END,
    NULLIF(trim(COALESCE(e.description, '')), ''),
    e.created_at::timestamptz,
    (
      e.created_by = auth.uid()
      OR (p_artista_atual_id IS NOT NULL AND e.artist_id = p_artista_atual_id)
      OR EXISTS (
        SELECT 1
        FROM artist_members am
        WHERE am.artist_id = e.artist_id
          AND am.user_id = auth.uid()
      )
    ),
    CASE
      WHEN e.created_by = auth.uid()
        OR (p_artista_atual_id IS NOT NULL AND e.artist_id = p_artista_atual_id)
        OR EXISTS (
          SELECT 1
          FROM artist_members am
          WHERE am.artist_id = e.artist_id
            AND am.user_id = auth.uid()
        )
      THEN e.value
      ELSE NULL
    END,
    (e.value IS NOT NULL AND e.value > 0)
  FROM events e
  INNER JOIN artists a ON a.id = e.artist_id
  WHERE COALESCE(e.ativo, true) = true
    AND e.feed_tipo IS NOT NULL
    AND e.event_date >= CURRENT_DATE
    AND (
      p_tipo IS NULL
      OR trim(p_tipo) = ''
      OR p_tipo = 'todos'
      OR (p_tipo = 'meus' AND p_artista_atual_id IS NOT NULL AND e.artist_id = p_artista_atual_id)
      OR e.feed_tipo = p_tipo
    )
    AND (
      length(trim(coalesce(p_estado, ''))) < 2
      OR (
        coalesce(trim(e.state_uf), '') <> ''
        AND upper(trim(e.state_uf)) = upper(trim(p_estado))
      )
    )
    AND (
      length(trim(coalesce(p_cidade, ''))) < 2
      OR (
        coalesce(trim(e.city), '') <> ''
        AND strpos(
          public.normalize_pt_search(e.city),
          public.normalize_pt_search(p_cidade)
        ) > 0
      )
    )
  ORDER BY
    CASE WHEN p_artista_atual_id IS NOT NULL AND e.artist_id = p_artista_atual_id THEN 0 ELSE 1 END,
    e.event_date ASC,
    e.created_at DESC
  LIMIT 120;
$$;

GRANT EXECUTE ON FUNCTION public.listar_feed_marketplace(TEXT, TEXT, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.listar_feed_marketplace(TEXT, TEXT, TEXT, UUID) TO service_role;

-- =====================================================
-- Publicar anúncio
-- =====================================================
CREATE OR REPLACE FUNCTION public.rpc_app_publicar_feed(
  p_artista_id UUID,
  p_feed_tipo TEXT,
  p_event_date DATE,
  p_state_uf TEXT,
  p_cache_valor NUMERIC,
  p_city TEXT DEFAULT NULL,
  p_start_time TIME DEFAULT TIME '20:00',
  p_end_time TIME DEFAULT TIME '23:00',
  p_observacao TEXT DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  error TEXT,
  evento_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_uf TEXT;
  v_city TEXT;
  v_name TEXT;
  v_id UUID;
  v_start TIME;
  v_end TIME;
BEGIN
  IF v_uid IS NULL THEN
    RETURN QUERY SELECT false, 'Usuário não autenticado.', NULL::UUID;
    RETURN;
  END IF;

  IF p_feed_tipo IS NULL OR p_feed_tipo NOT IN ('disponivel', 'demanda') THEN
    RETURN QUERY SELECT false, 'Tipo de anúncio inválido.', NULL::UUID;
    RETURN;
  END IF;

  IF p_event_date IS NULL OR p_event_date < CURRENT_DATE THEN
    RETURN QUERY SELECT false, 'Informe uma data de hoje em diante.', NULL::UUID;
    RETURN;
  END IF;

  v_uf := upper(trim(coalesce(p_state_uf, '')));
  IF length(v_uf) <> 2 THEN
    v_uf := NULL;
  END IF;

  IF p_cache_valor IS NOT NULL AND p_cache_valor < 0 THEN
    RETURN QUERY SELECT false, 'Cachê inválido.', NULL::UUID;
    RETURN;
  END IF;

  IF NOT public._is_member_of_artist(
    v_uid,
    p_artista_id,
    ARRAY['editor', 'vendedor', 'admin', 'owner']
  ) THEN
    RETURN QUERY SELECT false, 'Sem permissão para publicar no feed deste artista.', NULL::UUID;
    RETURN;
  END IF;

  v_city := NULLIF(trim(coalesce(p_city, '')), '');
  IF p_start_time IS NULL OR p_end_time IS NULL THEN
    RETURN QUERY SELECT false, 'Informe o horário de início e de fim.', NULL::UUID;
    RETURN;
  END IF;
  v_start := p_start_time;
  v_end := p_end_time;
  IF v_end <= v_start THEN
    RETURN QUERY SELECT false, 'O horário final precisa ser depois do início.', NULL::UUID;
    RETURN;
  END IF;

  v_name := CASE
    WHEN p_feed_tipo = 'disponivel' THEN 'Oferta'
    ELSE 'Procurando'
  END
  || ' · '
  || COALESCE(NULLIF(COALESCE(v_city || '/', '') || COALESCE(v_uf, ''), ''), 'Sem local')
  || ' · '
  || to_char(p_event_date, 'DD/MM/YYYY');

  INSERT INTO events (
    artist_id,
    created_by,
    updated_by,
    name,
    description,
    event_date,
    start_time,
    end_time,
    value,
    city,
    state_uf,
    confirmed,
    tag,
    feed_tipo,
    ativo,
    created_at,
    updated_at
  ) VALUES (
    p_artista_id,
    v_uid,
    v_uid,
    v_name,
    NULLIF(trim(coalesce(p_observacao, '')), ''),
    p_event_date,
    v_start,
    v_end,
    NULLIF(p_cache_valor, 0),
    v_city,
    v_uf,
    false,
    'evento',
    p_feed_tipo,
    true,
    NOW(),
    NOW()
  )
  RETURNING id INTO v_id;

  RETURN QUERY SELECT true, NULL::TEXT, v_id;
EXCEPTION
  WHEN OTHERS THEN
    RETURN QUERY SELECT false, SQLERRM, NULL::UUID;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_app_publicar_feed(UUID, TEXT, DATE, TEXT, NUMERIC, TEXT, TIME, TIME, TEXT) TO authenticated;

-- =====================================================
-- Encerrar anúncio
-- =====================================================
CREATE OR REPLACE FUNCTION public.rpc_app_encerrar_anuncio_feed(
  p_evento_id UUID
)
RETURNS TABLE (
  success BOOLEAN,
  error TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_event events%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RETURN QUERY SELECT false, 'Usuário não autenticado.';
    RETURN;
  END IF;

  SELECT * INTO v_event
  FROM events e
  WHERE e.id = p_evento_id
  LIMIT 1;

  IF v_event.id IS NULL OR v_event.feed_tipo IS NULL OR COALESCE(v_event.ativo, true) = false THEN
    RETURN QUERY SELECT false, 'Anúncio não encontrado.';
    RETURN;
  END IF;

  IF NOT public._is_member_of_artist(
    v_uid,
    v_event.artist_id,
    ARRAY['editor', 'vendedor', 'admin', 'owner']
  ) THEN
    RETURN QUERY SELECT false, 'Sem permissão para encerrar este anúncio.';
    RETURN;
  END IF;

  UPDATE events
  SET
    ativo = false,
    update_ativo = NOW(),
    updated_by = v_uid,
    updated_at = NOW()
  WHERE id = v_event.id;

  RETURN QUERY SELECT true, NULL::TEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_app_encerrar_anuncio_feed(UUID) TO authenticated;

-- =====================================================
-- Iniciar negociação (revela o cachê no convite)
-- =====================================================
CREATE OR REPLACE FUNCTION public.rpc_app_iniciar_negociacao_feed(
  p_evento_id UUID,
  p_artista_interessado_id UUID,
  p_funcao_participacao TEXT,
  p_mensagem TEXT DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  error TEXT,
  convite_id UUID,
  cache_valor NUMERIC,
  feed_tipo TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_event events%ROWTYPE;
  v_convite_id UUID;
  v_origem_id UUID;
  v_convidado_id UUID;
  v_owner_name TEXT;
  v_booking_name TEXT;
  v_funcao TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN QUERY SELECT false, 'Usuário não autenticado.', NULL::UUID, NULL::NUMERIC, NULL::TEXT;
    RETURN;
  END IF;

  v_funcao := NULLIF(trim(coalesce(p_funcao_participacao, '')), '');
  IF v_funcao IS NULL THEN
    RETURN QUERY SELECT false, 'Informe a função da participação.', NULL::UUID, NULL::NUMERIC, NULL::TEXT;
    RETURN;
  END IF;

  IF NOT public._is_member_of_artist(
    v_uid,
    p_artista_interessado_id,
    ARRAY['editor', 'vendedor', 'admin', 'owner']
  ) THEN
    RETURN QUERY SELECT false, 'Sem permissão para negociar com este artista.', NULL::UUID, NULL::NUMERIC, NULL::TEXT;
    RETURN;
  END IF;

  SELECT * INTO v_event
  FROM events e
  WHERE e.id = p_evento_id
    AND COALESCE(e.ativo, true) = true
  LIMIT 1;

  IF v_event.id IS NULL OR v_event.feed_tipo IS NULL THEN
    RETURN QUERY SELECT false, 'Anúncio não encontrado ou já encerrado.', NULL::UUID, NULL::NUMERIC, NULL::TEXT;
    RETURN;
  END IF;

  IF v_event.event_date < CURRENT_DATE THEN
    RETURN QUERY SELECT false, 'Esta data já passou.', NULL::UUID, NULL::NUMERIC, NULL::TEXT;
    RETURN;
  END IF;

  IF v_event.artist_id = p_artista_interessado_id
    OR v_event.created_by = v_uid
    OR EXISTS (
      SELECT 1
      FROM artist_members am
      WHERE am.artist_id = v_event.artist_id
        AND am.user_id = v_uid
    )
  THEN
    RETURN QUERY SELECT false, 'Você não pode negociar o próprio anúncio.', NULL::UUID, NULL::NUMERIC, NULL::TEXT;
    RETURN;
  END IF;

  IF v_event.value IS NULL OR v_event.value <= 0 THEN
    RETURN QUERY SELECT false, 'Este anúncio está sem cachê válido.', NULL::UUID, NULL::NUMERIC, NULL::TEXT;
    RETURN;
  END IF;

  SELECT a.name INTO v_owner_name
  FROM artists a
  WHERE a.id = v_event.artist_id
  LIMIT 1;

  IF v_event.feed_tipo = 'demanda' THEN
    v_origem_id := v_event.id;
    v_convidado_id := p_artista_interessado_id;

    IF EXISTS (
      SELECT 1
      FROM convite_participacao_evento c
      WHERE c.evento_origem_id = v_event.id
        AND c.artista_convidado_id = p_artista_interessado_id
        AND c.status = 'pendente'
    ) THEN
      RETURN QUERY SELECT false, 'Você já iniciou uma negociação neste anúncio.', NULL::UUID, NULL::NUMERIC, NULL::TEXT;
      RETURN;
    END IF;
  ELSE
    -- Disponibilidade: quem se interessou vira organizador (paga o cachê)
    -- e convida o artista que ofereceu a data.
    IF EXISTS (
      SELECT 1
      FROM convite_participacao_evento c
      WHERE c.grupo_disputa_id = v_event.id
        AND c.artista_que_convidou_id = p_artista_interessado_id
        AND c.status = 'pendente'
    ) THEN
      RETURN QUERY SELECT false, 'Você já iniciou uma negociação nesta data.', NULL::UUID, NULL::NUMERIC, NULL::TEXT;
      RETURN;
    END IF;

    v_booking_name := COALESCE(NULLIF(trim(v_event.name), ''), 'Show')
      || ' · '
      || COALESCE(NULLIF(trim(v_owner_name), ''), 'Artista');

    INSERT INTO events (
      artist_id,
      created_by,
      updated_by,
      name,
      description,
      event_date,
      start_time,
      end_time,
      value,
      city,
      state_uf,
      confirmed,
      tag,
      feed_tipo,
      ativo,
      created_at,
      updated_at
    ) VALUES (
      p_artista_interessado_id,
      v_uid,
      v_uid,
      v_booking_name,
      NULLIF(trim(coalesce(p_mensagem, '')), ''),
      v_event.event_date,
      v_event.start_time,
      v_event.end_time,
      v_event.value,
      v_event.city,
      v_event.state_uf,
      false,
      'evento',
      NULL,
      true,
      NOW(),
      NOW()
    )
    RETURNING id INTO v_origem_id;

    v_convidado_id := v_event.artist_id;
  END IF;

  INSERT INTO convite_participacao_evento (
    evento_origem_id,
    artista_que_convidou_id,
    artista_convidado_id,
    status,
    mensagem,
    nome_evento,
    data_evento,
    hora_inicio,
    hora_fim,
    cache_valor,
    cidade,
    estado_uf,
    telefone_contratante,
    descricao,
    funcao_participacao,
    usuario_que_enviou_id,
    grupo_disputa_id
  ) VALUES (
    v_origem_id,
    CASE
      WHEN v_event.feed_tipo = 'demanda' THEN v_event.artist_id
      ELSE p_artista_interessado_id
    END,
    v_convidado_id,
    'pendente',
    NULLIF(trim(coalesce(p_mensagem, '')), ''),
    v_event.name,
    v_event.event_date,
    v_event.start_time,
    v_event.end_time,
    v_event.value,
    v_event.city,
    v_event.state_uf,
    NULL,
    v_event.description,
    v_funcao,
    v_uid,
    v_event.id
  )
  RETURNING id INTO v_convite_id;

  RETURN QUERY SELECT true, NULL::TEXT, v_convite_id, v_event.value, v_event.feed_tipo;
EXCEPTION
  WHEN unique_violation THEN
    RETURN QUERY SELECT false, 'Já existe uma negociação pendente neste anúncio.', NULL::UUID, NULL::NUMERIC, NULL::TEXT;
  WHEN OTHERS THEN
    RETURN QUERY SELECT false, SQLERRM, NULL::UUID, NULL::NUMERIC, NULL::TEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_app_iniciar_negociacao_feed(UUID, UUID, TEXT, TEXT) TO authenticated;

-- Ao aceitar a negociação: demanda vira evento real; disponibilidade sai do feed
CREATE OR REPLACE FUNCTION public.trg_feed_apos_aceitar_convite()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'aceito' AND OLD.status IS DISTINCT FROM 'aceito' THEN
    UPDATE events
    SET
      feed_tipo = NULL,
      confirmed = true,
      updated_at = NOW()
    WHERE id = NEW.evento_origem_id
      AND feed_tipo = 'demanda'
      AND COALESCE(ativo, true) = true;

    UPDATE events
    SET
      ativo = false,
      update_ativo = NOW(),
      feed_tipo = NULL,
      updated_at = NOW()
    WHERE id = NEW.grupo_disputa_id
      AND feed_tipo = 'disponivel'
      AND COALESCE(ativo, true) = true;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_feed_apos_aceitar_convite ON public.convite_participacao_evento;
CREATE TRIGGER trg_feed_apos_aceitar_convite
  AFTER UPDATE OF status ON public.convite_participacao_evento
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_feed_apos_aceitar_convite();

NOTIFY pgrst, 'reload schema';

SELECT
  p.proname AS funcao,
  pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'listar_feed_marketplace',
    'rpc_app_publicar_feed',
    'rpc_app_encerrar_anuncio_feed',
    'rpc_app_iniciar_negociacao_feed'
  )
ORDER BY 1;
