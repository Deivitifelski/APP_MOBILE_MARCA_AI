-- Melhoria na busca de convite de colaborador (rode no SQL Editor se já aplicou CONVITE_PARTICIPACAO_EVENTO.sql antes).
-- - Corrige: nome digitado sem acento não achava cadastro com acento (João vs joao).
-- - Busca somente em artists.name (nome do artista).

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

-- Troca de colunas de retorno exige DROP (42P13: cannot change return type of existing function)
DROP FUNCTION IF EXISTS public.buscar_artistas_para_convite(text, uuid);

CREATE OR REPLACE FUNCTION public.buscar_artistas_para_convite(p_termo text, p_excluir_artista_id uuid)
RETURNS TABLE (
  id uuid,
  name text,
  profile_url text,
  image_url text,
  musical_style text,
  work_roles jsonb,
  show_formats jsonb
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
    COALESCE(a.show_formats, '[]'::jsonb)
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
  ORDER BY a.name;
$$;

GRANT EXECUTE ON FUNCTION public.buscar_artistas_para_convite(text, uuid) TO authenticated;
