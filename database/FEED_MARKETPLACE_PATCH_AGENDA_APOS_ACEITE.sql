-- Publicação do feed (oferecendo/procurando) NÃO entra na agenda.
-- Só vira evento de agenda depois que a proposta é aceita, nos dois artistas.
--
-- Rode no SQL Editor do Supabase.

BEGIN;

-- =====================================================
-- 1) Agenda ignora anúncios do feed
-- =====================================================
DROP FUNCTION IF EXISTS public.get_events_by_role(uuid);
DROP FUNCTION IF EXISTS public.get_event_by_id_with_role(uuid);

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

CREATE FUNCTION public.get_event_by_id_with_role(p_event_id UUID)
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
  event_artist_id UUID;
BEGIN
  SELECT e.artist_id INTO event_artist_id
  FROM events e
  WHERE e.id = p_event_id
    AND e.ativo IS TRUE
    AND e.feed_tipo IS NULL;

  IF event_artist_id IS NULL THEN
    RAISE EXCEPTION 'Evento não encontrado';
  END IF;

  SELECT am.role INTO user_role_var
  FROM artist_members am
  WHERE am.user_id = auth.uid()
    AND am.artist_id = event_artist_id;

  IF user_role_var IS NULL THEN
    RAISE EXCEPTION 'Usuário não tem acesso a este evento';
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
  WHERE e.id = p_event_id
    AND e.ativo IS TRUE
    AND e.feed_tipo IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_events_by_role(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_events_by_role(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_event_by_id_with_role(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_event_by_id_with_role(UUID) TO service_role;

-- =====================================================
-- 2) Proposta em oferta: evento rascunho (fora da agenda) até o aceite
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

  IF v_event.id IS NULL OR v_event.feed_tipo IS NULL OR COALESCE(v_event.ativo, true) = false THEN
    RETURN QUERY SELECT false, 'Anúncio não encontrado ou já encerrado.', NULL::UUID, NULL::NUMERIC, NULL::TEXT;
    RETURN;
  END IF;

  IF v_event.feed_tipo = 'demanda' AND v_funcao IS NULL THEN
    RETURN QUERY SELECT false, 'Informe a função que você está oferecendo.', NULL::UUID, NULL::NUMERIC, NULL::TEXT;
    RETURN;
  END IF;
  IF v_funcao IS NULL THEN
    v_funcao := 'Interesse';
  END IF;

  IF v_event.event_date < public.feed_data_hoje_brasil() THEN
    RETURN QUERY SELECT false, 'Esta data já passou.', NULL::UUID, NULL::NUMERIC, NULL::TEXT;
    RETURN;
  END IF;

  IF v_event.artist_id = p_artista_interessado_id THEN
    RETURN QUERY SELECT false, 'Você não pode negociar o próprio anúncio.', NULL::UUID, NULL::NUMERIC, NULL::TEXT;
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
        AND c.status IN ('pendente', 'aceito')
    ) THEN
      RETURN QUERY SELECT false, 'Você já enviou uma proposta neste anúncio.', NULL::UUID, NULL::NUMERIC, NULL::TEXT;
      RETURN;
    END IF;
  ELSE
    IF EXISTS (
      SELECT 1
      FROM convite_participacao_evento c
      WHERE c.grupo_disputa_id = v_event.id
        AND c.artista_que_convidou_id = p_artista_interessado_id
        AND c.status IN ('pendente', 'aceito')
    ) THEN
      RETURN QUERY SELECT false, 'Você já enviou uma proposta neste anúncio.', NULL::UUID, NULL::NUMERIC, NULL::TEXT;
      RETURN;
    END IF;

    v_booking_name := COALESCE(NULLIF(trim(v_event.name), ''), 'Show')
      || ' · '
      || COALESCE(NULLIF(trim(v_owner_name), ''), 'Artista');

    -- Rascunho: só entra na agenda depois do aceite.
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
      false,
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
    RETURN QUERY SELECT false, 'Você já enviou uma proposta neste anúncio.', NULL::UUID, NULL::NUMERIC, NULL::TEXT;
  WHEN OTHERS THEN
    RETURN QUERY SELECT false, SQLERRM, NULL::UUID, NULL::NUMERIC, NULL::TEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_app_iniciar_negociacao_feed(UUID, UUID, TEXT, TEXT) TO authenticated;

-- =====================================================
-- 3) Aceite: agenda dos dois lados
-- =====================================================
CREATE OR REPLACE FUNCTION public.trg_feed_apos_aceitar_convite()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'aceito' AND OLD.status IS DISTINCT FROM 'aceito' THEN
    -- Procurando: o anúncio do publicador vira evento real da agenda.
    UPDATE events
    SET
      feed_tipo = NULL,
      confirmed = true,
      ativo = true,
      updated_at = NOW()
    WHERE id = NEW.evento_origem_id
      AND feed_tipo = 'demanda'
      AND COALESCE(ativo, true) = true;

    -- Oferecendo: rascunho de quem se interessou entra na agenda.
    UPDATE events
    SET
      ativo = true,
      confirmed = true,
      updated_at = NOW()
    WHERE id = NEW.evento_origem_id
      AND feed_tipo IS NULL
      AND artist_id = NEW.artista_que_convidou_id;

    -- Oferecendo: anúncio original sai do feed.
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

-- Propostas de oferta ainda pendentes: tira o rascunho da agenda
UPDATE events e
SET
  ativo = false,
  update_ativo = NOW(),
  updated_at = NOW()
FROM convite_participacao_evento c
JOIN events listing
  ON listing.id = c.grupo_disputa_id
 AND listing.feed_tipo = 'disponivel'
WHERE e.id = c.evento_origem_id
  AND c.status = 'pendente'
  AND e.feed_tipo IS NULL
  AND e.artist_id = c.artista_que_convidou_id
  AND e.id IS DISTINCT FROM listing.id
  AND COALESCE(e.ativo, true) = true;

COMMIT;

NOTIFY pgrst, 'reload schema';
