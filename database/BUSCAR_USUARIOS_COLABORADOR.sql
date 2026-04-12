-- Busca usuários para convite de colaborador:
-- - Só quem já é "artista" no app: tem pelo menos uma linha em `artist_members` (algum perfil).
-- - Não pode já ser membro do artista alvo (`p_artista_id`).
-- - Não lista o próprio usuário logado.
-- Busca pelo nome da conta (`users.name`), prefixo no início de cada palavra (normalizado).
-- Colunas extras no retorno seguem o contrato do app (muitas vêm NULL / []); cidade/UF de `users`.

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
  SELECT
    u.id,
    u.name::text,
    u.email::text,
    u.profile_url::text,
    NULL::text AS artist_display_name,
    u.profile_url::text AS artist_image_url,
    NULL::text AS musical_style,
    NULL::text AS whatsapp,
    u.city::text,
    u.state::text,
    '[]'::jsonb AS work_roles,
    '[]'::jsonb AS show_formats
  FROM public.users u
  WHERE p_artista_id IS NOT NULL
    AND length(trim(coalesce(p_termo, ''))) >= 2
    AND length(public.normalize_pt_search(p_termo)) >= 2
    AND EXISTS (
      SELECT 1
      FROM unnest(
        regexp_split_to_array(
          public.normalize_pt_search(COALESCE(u.name, '')),
          '\s+'
        )
      ) AS w(word)
      WHERE length(word) > 0
        AND word LIKE public.normalize_pt_search(p_termo) || '%'
    )
    AND u.id IS DISTINCT FROM auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.artist_members am_any
      WHERE am_any.user_id = u.id
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.artist_members mx
      WHERE mx.artist_id = p_artista_id
        AND mx.user_id = u.id
    )
  ORDER BY u.name ASC NULLS LAST
  LIMIT 50;
$$;

GRANT EXECUTE ON FUNCTION public.buscar_usuarios_para_convite_colaborador(text, uuid) TO authenticated;
