-- Patch rápido: curtidas e comentários no feed social.
-- Rode no SQL Editor do Supabase se o like/comentário pedir para atualizar o banco.
-- Pode executar mais de uma vez (idempotente).

CREATE OR REPLACE FUNCTION public._is_member_of_artist(
  p_user_id UUID,
  p_artist_id UUID,
  p_roles TEXT[] DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.artist_members am
    WHERE am.user_id = p_user_id
      AND am.artist_id = p_artist_id
      AND (p_roles IS NULL OR am.role = ANY(p_roles))
  );
$$;

-- Atualiza listagem com liked_by_me
DROP FUNCTION IF EXISTS public.listar_feed_social(uuid, boolean);

CREATE OR REPLACE FUNCTION public.listar_feed_social(
  p_artista_atual_id UUID DEFAULT NULL,
  p_somente_meus BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
  id UUID,
  artist_id UUID,
  artist_name TEXT,
  artist_image TEXT,
  body TEXT,
  location TEXT,
  created_at TIMESTAMPTZ,
  media_type TEXT,
  media_url TEXT,
  thumbnail_url TEXT,
  likes_count INTEGER,
  comments_count INTEGER,
  is_mine BOOLEAN,
  liked_by_me BOOLEAN
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    sp.id,
    sp.artist_id,
    a.name,
    NULLIF(trim(COALESCE(a.profile_url, '')), ''),
    sp.body,
    NULLIF(trim(COALESCE(sp.location, '')), ''),
    sp.created_at,
    media.media_type,
    media.media_url,
    media.thumbnail_url,
    (
      SELECT COUNT(*)::integer
      FROM public.social_post_likes spl
      WHERE spl.post_id = sp.id
    ),
    (
      SELECT COUNT(*)::integer
      FROM public.social_post_comments spc
      WHERE spc.post_id = sp.id
    ),
    (p_artista_atual_id IS NOT NULL AND sp.artist_id = p_artista_atual_id),
    (
      p_artista_atual_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.social_post_likes spl_me
        WHERE spl_me.post_id = sp.id
          AND spl_me.artist_id = p_artista_atual_id
      )
    )
  FROM public.social_posts sp
  INNER JOIN public.artists a ON a.id = sp.artist_id
  LEFT JOIN LATERAL (
    SELECT
      spm.media_type,
      spm.media_url,
      spm.thumbnail_url
    FROM public.social_post_media spm
    WHERE spm.post_id = sp.id
    ORDER BY spm.sort_order, spm.created_at
    LIMIT 1
  ) media ON true
  WHERE sp.is_published = true
    AND (
      NOT COALESCE(p_somente_meus, false)
      OR (p_artista_atual_id IS NOT NULL AND sp.artist_id = p_artista_atual_id)
    )
  ORDER BY sp.created_at DESC
  LIMIT 120;
$$;

GRANT EXECUTE ON FUNCTION public.listar_feed_social(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.listar_feed_social(UUID, BOOLEAN) TO service_role;

-- Curtir / descurtir
DROP FUNCTION IF EXISTS public.rpc_app_alternar_curtida_social_post(uuid, uuid);

CREATE OR REPLACE FUNCTION public.rpc_app_alternar_curtida_social_post(
  p_post_id UUID,
  p_artista_id UUID
)
RETURNS TABLE (
  success BOOLEAN,
  error TEXT,
  liked BOOLEAN,
  likes_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_post public.social_posts%ROWTYPE;
  v_liked BOOLEAN;
  v_count INTEGER;
BEGIN
  IF v_uid IS NULL THEN
    RETURN QUERY SELECT false, 'Usuário não autenticado.', false, 0;
    RETURN;
  END IF;

  SELECT * INTO v_post
  FROM public.social_posts
  WHERE id = p_post_id AND is_published = true
  LIMIT 1;

  IF v_post.id IS NULL THEN
    RETURN QUERY SELECT false, 'Publicação não encontrada.', false, 0;
    RETURN;
  END IF;

  IF NOT public._is_member_of_artist(v_uid, p_artista_id, NULL) THEN
    RETURN QUERY SELECT false, 'Sem permissão para curtir neste artista.', false, 0;
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.social_post_likes spl
    WHERE spl.post_id = p_post_id
      AND spl.artist_id = p_artista_id
  ) THEN
    DELETE FROM public.social_post_likes
    WHERE post_id = p_post_id
      AND artist_id = p_artista_id;
    v_liked := false;
  ELSE
    INSERT INTO public.social_post_likes (post_id, artist_id)
    VALUES (p_post_id, p_artista_id)
    ON CONFLICT (post_id, artist_id) DO NOTHING;
    v_liked := true;
  END IF;

  SELECT COUNT(*)::integer INTO v_count
  FROM public.social_post_likes
  WHERE post_id = p_post_id;

  RETURN QUERY SELECT true, NULL::TEXT, v_liked, v_count;
EXCEPTION
  WHEN OTHERS THEN
    RETURN QUERY SELECT false, SQLERRM, false, 0;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_app_alternar_curtida_social_post(UUID, UUID) TO authenticated;

-- Listar comentários
DROP FUNCTION IF EXISTS public.listar_comentarios_social_post(uuid);

CREATE OR REPLACE FUNCTION public.listar_comentarios_social_post(
  p_post_id UUID
)
RETURNS TABLE (
  id UUID,
  post_id UUID,
  artist_id UUID,
  artist_name TEXT,
  artist_image TEXT,
  message TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    spc.id,
    spc.post_id,
    spc.artist_id,
    a.name,
    NULLIF(trim(COALESCE(a.profile_url, '')), ''),
    spc.message,
    spc.created_at
  FROM public.social_post_comments spc
  INNER JOIN public.artists a ON a.id = spc.artist_id
  INNER JOIN public.social_posts sp ON sp.id = spc.post_id
  WHERE spc.post_id = p_post_id
    AND sp.is_published = true
  ORDER BY spc.created_at ASC
  LIMIT 200;
$$;

GRANT EXECUTE ON FUNCTION public.listar_comentarios_social_post(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.listar_comentarios_social_post(UUID) TO service_role;

-- Comentar
DROP FUNCTION IF EXISTS public.rpc_app_comentar_social_post(uuid, uuid, text);

CREATE OR REPLACE FUNCTION public.rpc_app_comentar_social_post(
  p_post_id UUID,
  p_artista_id UUID,
  p_message TEXT
)
RETURNS TABLE (
  success BOOLEAN,
  error TEXT,
  comment_id UUID,
  comments_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_post public.social_posts%ROWTYPE;
  v_message TEXT;
  v_comment_id UUID;
  v_count INTEGER;
BEGIN
  IF v_uid IS NULL THEN
    RETURN QUERY SELECT false, 'Usuário não autenticado.', NULL::UUID, 0;
    RETURN;
  END IF;

  v_message := NULLIF(trim(coalesce(p_message, '')), '');

  IF v_message IS NULL THEN
    RETURN QUERY SELECT false, 'Escreva um comentário.', NULL::UUID, 0;
    RETURN;
  END IF;

  SELECT * INTO v_post
  FROM public.social_posts
  WHERE id = p_post_id AND is_published = true
  LIMIT 1;

  IF v_post.id IS NULL THEN
    RETURN QUERY SELECT false, 'Publicação não encontrada.', NULL::UUID, 0;
    RETURN;
  END IF;

  IF NOT public._is_member_of_artist(v_uid, p_artista_id, NULL) THEN
    RETURN QUERY SELECT false, 'Sem permissão para comentar neste artista.', NULL::UUID, 0;
    RETURN;
  END IF;

  INSERT INTO public.social_post_comments (post_id, artist_id, message)
  VALUES (p_post_id, p_artista_id, v_message)
  RETURNING id INTO v_comment_id;

  SELECT COUNT(*)::integer INTO v_count
  FROM public.social_post_comments
  WHERE post_id = p_post_id;

  RETURN QUERY SELECT true, NULL::TEXT, v_comment_id, v_count;
EXCEPTION
  WHEN OTHERS THEN
    RETURN QUERY SELECT false, SQLERRM, NULL::UUID, 0;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_app_comentar_social_post(UUID, UUID, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';

SELECT
  p.proname AS funcao,
  pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'listar_feed_social',
    'rpc_app_alternar_curtida_social_post',
    'listar_comentarios_social_post',
    'rpc_app_comentar_social_post'
  )
ORDER BY 1;
