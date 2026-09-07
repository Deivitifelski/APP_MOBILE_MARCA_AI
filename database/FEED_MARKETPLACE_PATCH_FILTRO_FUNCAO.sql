-- Patch: filtro por função/tag no feed marketplace.
-- Rode no SQL Editor do Supabase. Pode executar mais de uma vez (idempotente).

DROP FUNCTION IF EXISTS public.listar_feed_marketplace(text, text, text, uuid);
DROP FUNCTION IF EXISTS public.listar_feed_marketplace(text, text, text, uuid, text);

CREATE OR REPLACE FUNCTION public.listar_feed_marketplace(
  p_tipo TEXT DEFAULT NULL,
  p_estado TEXT DEFAULT NULL,
  p_cidade TEXT DEFAULT NULL,
  p_artista_atual_id UUID DEFAULT NULL,
  p_funcao TEXT DEFAULT NULL
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
  artist_whatsapp TEXT,
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
    NULLIF(trim(COALESCE(a.whatsapp, '')), ''),
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
    AND (
      length(trim(coalesce(p_funcao, ''))) < 2
      OR EXISTS (
        SELECT 1
        FROM unnest(COALESCE(e.feed_funcoes, ARRAY[]::text[])) AS funcao_item(funcao)
        WHERE public.normalize_pt_search(funcao_item.funcao)
          = public.normalize_pt_search(p_funcao)
      )
    )
  ORDER BY
    CASE WHEN p_artista_atual_id IS NOT NULL AND e.artist_id = p_artista_atual_id THEN 0 ELSE 1 END,
    e.created_at DESC
  LIMIT 120;
$$;

GRANT EXECUTE ON FUNCTION public.listar_feed_marketplace(TEXT, TEXT, TEXT, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.listar_feed_marketplace(TEXT, TEXT, TEXT, UUID, TEXT) TO service_role;

NOTIFY pgrst, 'reload schema';

SELECT
  p.proname AS funcao,
  pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'listar_feed_marketplace'
ORDER BY 1;
