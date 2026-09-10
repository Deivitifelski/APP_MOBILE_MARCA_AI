-- Oferta: o contratante informa os dados do evento ao demonstrar interesse.
-- Rode no SQL Editor do Supabase depois de FEED_MARKETPLACE_PATCH_NOME_EVENTO.sql.

CREATE OR REPLACE FUNCTION public.feed_funcoes_para_despesa(p_funcoes TEXT[])
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT NULLIF(
    array_to_string(
      ARRAY(
        SELECT NULLIF(trim(f), '')
        FROM unnest(COALESCE(p_funcoes, ARRAY[]::text[])) AS f
        WHERE NULLIF(trim(f), '') IS NOT NULL
      ),
      ' · '
    ),
    ''
  );
$$;

DROP FUNCTION IF EXISTS public.rpc_app_iniciar_negociacao_feed(uuid, uuid, text, text);
DROP FUNCTION IF EXISTS public.rpc_app_iniciar_negociacao_feed(uuid, uuid, text, text, text);
DROP FUNCTION IF EXISTS public.rpc_app_iniciar_negociacao_feed(uuid, uuid, text, text, text, date, time, time, text, text);

CREATE OR REPLACE FUNCTION public.rpc_app_iniciar_negociacao_feed(
  p_evento_id UUID,
  p_artista_interessado_id UUID,
  p_funcao_participacao TEXT,
  p_mensagem TEXT DEFAULT NULL,
  p_nome_evento TEXT DEFAULT NULL,
  p_event_date DATE DEFAULT NULL,
  p_start_time TIME DEFAULT NULL,
  p_end_time TIME DEFAULT NULL,
  p_city TEXT DEFAULT NULL,
  p_state_uf TEXT DEFAULT NULL
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
  v_booking_name TEXT;
  v_convite_nome TEXT;
  v_funcao TEXT;
  v_data DATE;
  v_start TIME;
  v_end TIME;
  v_city TEXT;
  v_uf TEXT;
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

  IF v_funcao IS NOT NULL AND lower(v_funcao) = 'interesse' THEN
    v_funcao := NULL;
  END IF;
  IF v_event.feed_tipo = 'demanda' THEN
    IF v_funcao IS NULL THEN
      RETURN QUERY SELECT false, 'Informe a função que você está oferecendo.', NULL::UUID, NULL::NUMERIC, NULL::TEXT;
      RETURN;
    END IF;
  ELSE
    v_funcao := COALESCE(
      v_funcao,
      public.feed_funcoes_para_despesa(v_event.feed_funcoes),
      'Participação'
    );
  END IF;

  IF v_event.event_date < public.feed_data_hoje_brasil() THEN
    RETURN QUERY SELECT false, 'Esta data já passou.', NULL::UUID, NULL::NUMERIC, NULL::TEXT;
    RETURN;
  END IF;

  IF v_event.artist_id = p_artista_interessado_id THEN
    RETURN QUERY SELECT false, 'Você não pode negociar o próprio anúncio.', NULL::UUID, NULL::NUMERIC, NULL::TEXT;
    RETURN;
  END IF;

  IF v_event.feed_tipo = 'demanda' THEN
    v_origem_id := v_event.id;
    v_convidado_id := p_artista_interessado_id;
    v_convite_nome := COALESCE(NULLIF(trim(v_event.name), ''), 'Evento');
    v_data := v_event.event_date;
    v_start := v_event.start_time;
    v_end := v_event.end_time;
    v_city := v_event.city;
    v_uf := v_event.state_uf;

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

    v_booking_name := NULLIF(trim(coalesce(p_nome_evento, '')), '');
    IF v_booking_name IS NULL THEN
      RETURN QUERY SELECT false, 'Informe o nome do seu evento.', NULL::UUID, NULL::NUMERIC, NULL::TEXT;
      RETURN;
    END IF;

    v_data := COALESCE(p_event_date, v_event.event_date);
    IF v_data IS NULL OR v_data < public.feed_data_hoje_brasil() THEN
      RETURN QUERY SELECT false, 'Informe uma data de hoje em diante para o evento.', NULL::UUID, NULL::NUMERIC, NULL::TEXT;
      RETURN;
    END IF;

    v_start := COALESCE(p_start_time, v_event.start_time);
    v_end := COALESCE(p_end_time, v_event.end_time);
    IF v_start IS NULL OR v_end IS NULL THEN
      RETURN QUERY SELECT false, 'Informe o horário de início e de fim do evento.', NULL::UUID, NULL::NUMERIC, NULL::TEXT;
      RETURN;
    END IF;
    IF v_end <= v_start THEN
      RETURN QUERY SELECT false, 'O horário final precisa ser depois do início.', NULL::UUID, NULL::NUMERIC, NULL::TEXT;
      RETURN;
    END IF;

    v_city := NULLIF(trim(coalesce(p_city, '')), '');
    v_uf := upper(trim(coalesce(p_state_uf, '')));
    IF length(v_uf) <> 2 THEN
      v_uf := NULL;
    END IF;
    IF v_city IS NULL THEN
      RETURN QUERY SELECT false, 'Informe a cidade do evento.', NULL::UUID, NULL::NUMERIC, NULL::TEXT;
      RETURN;
    END IF;

    v_convite_nome := v_booking_name;

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
      v_data,
      v_start,
      v_end,
      v_event.value,
      v_city,
      v_uf,
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
    v_convite_nome,
    v_data,
    v_start,
    v_end,
    v_event.value,
    v_city,
    v_uf,
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

GRANT EXECUTE ON FUNCTION public.rpc_app_iniciar_negociacao_feed(
  UUID, UUID, TEXT, TEXT, TEXT, DATE, TIME, TIME, TEXT, TEXT
) TO authenticated;

NOTIFY pgrst, 'reload schema';
