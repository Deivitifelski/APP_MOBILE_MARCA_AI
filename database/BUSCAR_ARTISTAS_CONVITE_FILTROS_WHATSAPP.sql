-- Atualiza buscar_artistas_para_convite: whatsapp + cidade/estado no retorno e filtros opcionais.
-- Rode no SQL Editor do Supabase após CONVITE_PARTICIPACAO_EVENTO / MELHORIA_BUSCAR_ARTISTAS_CONVITE.

-- Remove assinaturas antigas (evita conflito de overload / tipo de retorno)
DROP FUNCTION IF EXISTS public.buscar_artistas_para_convite(text, uuid);
DROP FUNCTION IF EXISTS public.buscar_artistas_para_convite(text, uuid, text, text, text);

CREATE OR REPLACE FUNCTION public.buscar_artistas_para_convite(
  p_termo text,
  p_excluir_artista_id uuid,
  p_cidade text DEFAULT NULL,
  p_estado text DEFAULT NULL,
  p_funcao text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  name text,
  profile_url text,
  image_url text,
  musical_style text,
  work_roles jsonb,
  show_formats jsonb,
  whatsapp text,
  city text,
  state text,
  show_whatsapp boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
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
    NULLIF(trim(COALESCE(a.city, '')), '')::text,
    NULLIF(trim(COALESCE(a.state, '')), '')::text,
    COALESCE(a.show_whatsapp, false)
  FROM artists a
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
  WHERE (p_excluir_artista_id IS NULL OR a.id <> p_excluir_artista_id)
    AND a.is_available_for_gigs IS TRUE
    AND length(trim(coalesce(p_termo, ''))) >= 2
    AND length(public.normalize_pt_search(p_termo)) >= 2
    AND strpos(public.normalize_pt_search(a.name), public.normalize_pt_search(p_termo)) > 0
    AND (
      length(trim(coalesce(p_cidade, ''))) < 2
      OR (
        coalesce(trim(a.city), '') <> ''
        AND strpos(public.normalize_pt_search(a.city), public.normalize_pt_search(p_cidade)) > 0
      )
    )
    AND (
      length(trim(coalesce(p_estado, ''))) < 2
      OR (
        coalesce(trim(a.state), '') <> ''
        AND (
          strpos(public.normalize_pt_search(a.state), public.normalize_pt_search(p_estado)) > 0
          OR upper(trim(a.state)) = upper(trim(p_estado))
        )
      )
    )
    AND (
      length(trim(coalesce(p_funcao, ''))) < 2
      OR EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(coalesce(a.work_roles, '[]'::jsonb)) AS w(v)
        WHERE length(trim(v)) > 0
          AND strpos(public.normalize_pt_search(v), public.normalize_pt_search(p_funcao)) > 0
      )
    )
  ORDER BY a.name;
$$;

GRANT EXECUTE ON FUNCTION public.buscar_artistas_para_convite(text, uuid, text, text, text) TO authenticated;
