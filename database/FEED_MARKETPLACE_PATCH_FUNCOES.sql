-- Patch: funções/tags nos anúncios do feed (Oferta / Procurando).
-- Rode no SQL Editor do Supabase. Pode executar mais de uma vez (idempotente).

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS feed_funcoes TEXT[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_events_feed_funcoes
  ON public.events USING GIN (feed_funcoes);

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
  feed_funcoes TEXT[],
  created_at TIMESTAMPTZ,
  is_mine BOOLEAN,
  meu_cache_valor NUMERIC,
  tem_cache BOOLEAN,
  propostas_count INTEGER,
  propostas_avatars TEXT[],
  ja_proposei BOOLEAN,
  pode_desfazer BOOLEAN
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
    COALESCE(e.feed_funcoes, ARRAY[]::text[]),
    e.created_at::timestamptz,
    (p_artista_atual_id IS NOT NULL AND e.artist_id = p_artista_atual_id),
    CASE
      WHEN p_artista_atual_id IS NOT NULL AND e.artist_id = p_artista_atual_id
      THEN e.value
      ELSE NULL
    END,
    (e.value IS NOT NULL AND e.value > 0),
    (
      SELECT COUNT(*)::integer
      FROM convite_participacao_evento c
      WHERE c.status IN ('pendente', 'aceito')
        AND (c.grupo_disputa_id = e.id OR c.evento_origem_id = e.id)
    ),
    COALESCE(
      (
        SELECT ARRAY(
          SELECT NULLIF(trim(COALESCE(ar.profile_url, '')), '')
          FROM convite_participacao_evento c
          INNER JOIN artists ar ON ar.id = CASE
            WHEN e.feed_tipo = 'demanda' THEN c.artista_convidado_id
            ELSE c.artista_que_convidou_id
          END
          WHERE c.status IN ('pendente', 'aceito')
            AND (c.grupo_disputa_id = e.id OR c.evento_origem_id = e.id)
          ORDER BY c.criado_em DESC
          LIMIT 3
        )
      ),
      ARRAY[]::text[]
    ),
    (
      p_artista_atual_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM convite_participacao_evento c
        WHERE c.status IN ('pendente', 'aceito')
          AND (c.grupo_disputa_id = e.id OR c.evento_origem_id = e.id)
          AND (
            (e.feed_tipo = 'demanda' AND c.artista_convidado_id = p_artista_atual_id)
            OR (e.feed_tipo <> 'demanda' AND c.artista_que_convidou_id = p_artista_atual_id)
          )
      )
    ),
    (
      p_artista_atual_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM convite_participacao_evento c
        WHERE c.status = 'pendente'
          AND (c.grupo_disputa_id = e.id OR c.evento_origem_id = e.id)
          AND (
            (e.feed_tipo = 'demanda' AND c.artista_convidado_id = p_artista_atual_id)
            OR (e.feed_tipo <> 'demanda' AND c.artista_que_convidou_id = p_artista_atual_id)
          )
      )
    )
  FROM events e
  INNER JOIN artists a ON a.id = e.artist_id
  WHERE COALESCE(e.ativo, true) = true
    AND e.feed_tipo IS NOT NULL
    AND e.feed_tipo IN ('disponivel', 'demanda')
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
    e.created_at DESC
  LIMIT 120;
$$;

GRANT EXECUTE ON FUNCTION public.listar_feed_marketplace(TEXT, TEXT, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.listar_feed_marketplace(TEXT, TEXT, TEXT, UUID) TO service_role;

DROP FUNCTION IF EXISTS public.rpc_app_publicar_feed(uuid, text, date, text, numeric, text, time, time, text);
DROP FUNCTION IF EXISTS public.rpc_app_publicar_feed(uuid, text, date, text, numeric, text, time, time, text, text[]);

CREATE OR REPLACE FUNCTION public.rpc_app_publicar_feed(
  p_artista_id UUID,
  p_feed_tipo TEXT,
  p_event_date DATE,
  p_state_uf TEXT,
  p_cache_valor NUMERIC,
  p_city TEXT DEFAULT NULL,
  p_start_time TIME DEFAULT TIME '20:00',
  p_end_time TIME DEFAULT TIME '23:00',
  p_observacao TEXT DEFAULT NULL,
  p_feed_funcoes TEXT[] DEFAULT ARRAY[]::text[]
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
  v_funcoes TEXT[];
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

  v_funcoes := ARRAY(
    SELECT DISTINCT trim(f)
    FROM unnest(COALESCE(p_feed_funcoes, ARRAY[]::text[])) AS f
    WHERE length(trim(f)) > 0
  );

  IF COALESCE(array_length(v_funcoes, 1), 0) = 0 THEN
    RETURN QUERY SELECT false, 'Selecione pelo menos uma função (ex.: Vocalista, Guitarrista).', NULL::UUID;
    RETURN;
  END IF;

  IF array_length(v_funcoes, 1) > 8 THEN
    RETURN QUERY SELECT false, 'Selecione no máximo 8 funções.', NULL::UUID;
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
    feed_funcoes,
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
    v_funcoes,
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

GRANT EXECUTE ON FUNCTION public.rpc_app_publicar_feed(UUID, TEXT, DATE, TEXT, NUMERIC, TEXT, TIME, TIME, TEXT, TEXT[]) TO authenticated;

NOTIFY pgrst, 'reload schema';

SELECT
  p.proname AS funcao,
  pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('listar_feed_marketplace', 'rpc_app_publicar_feed')
ORDER BY 1;
