-- Busca usuários para convite de colaborador: apenas quem tem perfil de artista
-- com `is_available_for_gigs = true`. Retorna dados do perfil do artista (sem cachê).
-- Exclui quem já é membro do artista alvo e o próprio usuário logado.

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

CREATE OR REPLACE FUNCTION public.buscar_usuarios_para_convite_colaborador(
  p_termo text,
  p_artista_id uuid
)
RETURNS TABLE (
  user_id uuid,
  name text,
  email text,
  profile_url text,
  artist_display_name text,
  artist_image_url text,
  musical_style text,
  whatsapp text,
  city text,
  state text,
  work_roles jsonb,
  show_formats jsonb
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT DISTINCT ON (u.id)
    u.id,
    u.name::text,
    u.email::text,
    u.profile_url::text,
    a.name::text AS artist_display_name,
    COALESCE(
      NULLIF(trim(COALESCE(a.profile_url, '')), ''),
      u.profile_url
    )::text AS artist_image_url,
    a.musical_style::text,
    a.whatsapp::text,
    a.city::text,
    a.state::text,
    COALESCE(a.work_roles, '[]'::jsonb),
    COALESCE(a.show_formats, '[]'::jsonb)
  FROM public.users u
  INNER JOIN public.artist_members am ON am.user_id = u.id
  INNER JOIN public.artists a ON a.id = am.artist_id
  WHERE a.is_available_for_gigs IS TRUE
    AND p_artista_id IS NOT NULL
    AND length(trim(coalesce(p_termo, ''))) >= 2
    AND length(public.normalize_pt_search(p_termo)) >= 2
    AND (
      strpos(public.normalize_pt_search(a.name), public.normalize_pt_search(p_termo)) > 0
      OR strpos(public.normalize_pt_search(u.name), public.normalize_pt_search(p_termo)) > 0
      OR strpos(public.normalize_pt_search(u.email), public.normalize_pt_search(p_termo)) > 0
    )
    AND u.id IS DISTINCT FROM auth.uid()
    AND NOT EXISTS (
      SELECT 1
      FROM public.artist_members mx
      WHERE mx.artist_id = p_artista_id
        AND mx.user_id = u.id
    )
  ORDER BY
    u.id,
    CASE am.role
      WHEN 'owner' THEN 1
      WHEN 'admin' THEN 2
      WHEN 'editor' THEN 3
      ELSE 4
    END,
    a.name ASC NULLS LAST;
$$;

GRANT EXECUTE ON FUNCTION public.buscar_usuarios_para_convite_colaborador(text, uuid) TO authenticated;
