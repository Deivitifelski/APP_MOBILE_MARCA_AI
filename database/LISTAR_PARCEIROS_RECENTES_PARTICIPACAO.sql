-- Idempotente: substitui a função se já existir.
DROP FUNCTION IF EXISTS public.listar_parceiros_recentes_participacao(UUID, INT);

-- Artistas que já aceitaram participação em algum evento convidado por este perfil (organizador).
-- Usado na tela "Participação de outro artista" como atalho antes da busca por nome.
-- Pré-requisito: tabelas convite_participacao_evento, artists, artist_members, users.
-- Rode no SQL Editor do Supabase.

CREATE OR REPLACE FUNCTION public.listar_parceiros_recentes_participacao(
  p_artista_que_convida_id UUID,
  p_limite INT DEFAULT 15
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  profile_url TEXT,
  image_url TEXT,
  musical_style TEXT,
  work_roles JSONB,
  show_formats JSONB,
  whatsapp TEXT,
  city TEXT,
  state TEXT,
  show_whatsapp BOOLEAN,
  is_available_for_gigs BOOLEAN,
  ultima_funcao TEXT,
  ultima_colaboracao_em TIMESTAMPTZ,
  participacao_data_evento DATE,
  ultimo_cache_valor NUMERIC(12, 2)
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH allowed AS (
    SELECT 1
    WHERE EXISTS (
      SELECT 1
      FROM artist_members am
      WHERE am.user_id = auth.uid()
        AND am.artist_id = p_artista_que_convida_id
    )
  ),
  latest AS (
    SELECT DISTINCT ON (c.artista_convidado_id)
      c.artista_convidado_id AS aid,
      NULLIF(trim(COALESCE(c.funcao_participacao, '')), '') AS ultima_funcao,
      COALESCE(c.respondido_em, c.atualizado_em, c.criado_em) AS ultima_colaboracao_em,
      c.data_evento AS participacao_data_evento,
      c.cache_valor AS ultimo_cache_valor
    FROM convite_participacao_evento c
    CROSS JOIN allowed
    WHERE c.artista_que_convidou_id = p_artista_que_convida_id
      AND c.status = 'aceito'
    ORDER BY c.artista_convidado_id, COALESCE(c.respondido_em, c.atualizado_em, c.criado_em) DESC
  )
  SELECT
    a.id,
    a.name,
    a.profile_url,
    COALESCE(
      NULLIF(trim(COALESCE(a.profile_url, '')), ''),
      lu.member_profile_url
    ) AS image_url,
    a.musical_style,
    COALESCE(a.work_roles, '[]'::jsonb),
    COALESCE(a.show_formats, '[]'::jsonb),
    CASE
      WHEN COALESCE(a.show_whatsapp, false) IS TRUE THEN NULLIF(trim(COALESCE(a.whatsapp, '')), '')
      ELSE NULL
    END,
    NULLIF(trim(COALESCE(a.city, '')), ''),
    NULLIF(trim(COALESCE(a.state, '')), ''),
    COALESCE(a.show_whatsapp, false),
    COALESCE(a.is_available_for_gigs, false),
    l.ultima_funcao,
    l.ultima_colaboracao_em,
    l.participacao_data_evento,
    l.ultimo_cache_valor
  FROM latest l
  INNER JOIN artists a ON a.id = l.aid
  LEFT JOIN LATERAL (
    SELECT u.profile_url AS member_profile_url
    FROM artist_members am
    INNER JOIN users u ON u.id = am.user_id
    WHERE am.artist_id = a.id
      AND u.profile_url IS NOT NULL
      AND trim(COALESCE(u.profile_url, '')) <> ''
    ORDER BY
      CASE am.role
        WHEN 'owner' THEN 1
        WHEN 'admin' THEN 2
        WHEN 'editor' THEN 3
        ELSE 4
      END,
      am.created_at ASC NULLS LAST
    LIMIT 1
  ) lu ON true
  CROSS JOIN allowed
  ORDER BY l.ultima_colaboracao_em DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limite, 15), 50));
$$;

REVOKE ALL ON FUNCTION public.listar_parceiros_recentes_participacao(UUID, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.listar_parceiros_recentes_participacao(UUID, INT) TO authenticated;

COMMENT ON FUNCTION public.listar_parceiros_recentes_participacao(UUID, INT) IS
  'Lista artistas que já aceitaram convite de participação deste artista, ordenados pela última colaboração.';
