-- Feed social (foto/vídeo, curtidas, comentários).
-- Cole no SQL Editor do Supabase. Pode rodar mais de uma vez (idempotente).
--
-- Ofertas/Procurando continuam em events + FEED_MARKETPLACE.sql.
-- Este arquivo é só para posts sociais (social_posts).

-- Helper compartilhado (idempotente; também existe em outros SQLs do projeto)
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

-- =========================================================
-- TABELAS
-- =========================================================
CREATE TABLE IF NOT EXISTS public.social_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id uuid NOT NULL REFERENCES public.artists(id) ON DELETE CASCADE,
  body text NOT NULL,
  location text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  is_published boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.social_post_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.social_posts(id) ON DELETE CASCADE,
  media_type text NOT NULL CHECK (media_type IN ('image', 'video')),
  media_url text NOT NULL,
  thumbnail_url text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.social_post_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.social_posts(id) ON DELETE CASCADE,
  tag text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.social_post_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.social_posts(id) ON DELETE CASCADE,
  artist_id uuid NOT NULL REFERENCES public.artists(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, artist_id)
);

CREATE TABLE IF NOT EXISTS public.social_post_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.social_posts(id) ON DELETE CASCADE,
  artist_id uuid NOT NULL REFERENCES public.artists(id) ON DELETE CASCADE,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.social_post_comment_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid NOT NULL REFERENCES public.social_post_comments(id) ON DELETE CASCADE,
  artist_id uuid NOT NULL REFERENCES public.artists(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (comment_id, artist_id)
);

CREATE TABLE IF NOT EXISTS public.social_post_saved (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.social_posts(id) ON DELETE CASCADE,
  artist_id uuid NOT NULL REFERENCES public.artists(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, artist_id)
);

CREATE INDEX IF NOT EXISTS idx_social_posts_artist_id
  ON public.social_posts (artist_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_social_posts_published
  ON public.social_posts (is_published, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_social_post_media_post_id
  ON public.social_post_media (post_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_social_post_tags_post_id
  ON public.social_post_tags (post_id);

CREATE INDEX IF NOT EXISTS idx_social_post_likes_post_id
  ON public.social_post_likes (post_id);

CREATE INDEX IF NOT EXISTS idx_social_post_likes_artist_id
  ON public.social_post_likes (artist_id);

CREATE INDEX IF NOT EXISTS idx_social_post_comments_post_id
  ON public.social_post_comments (post_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_social_post_comments_artist_id
  ON public.social_post_comments (artist_id);

CREATE INDEX IF NOT EXISTS idx_social_post_comment_likes_comment_id
  ON public.social_post_comment_likes (comment_id);

CREATE INDEX IF NOT EXISTS idx_social_post_comment_likes_artist_id
  ON public.social_post_comment_likes (artist_id);

CREATE INDEX IF NOT EXISTS idx_social_post_saved_post_id
  ON public.social_post_saved (post_id);

CREATE INDEX IF NOT EXISTS idx_social_post_saved_artist_id
  ON public.social_post_saved (artist_id);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_social_posts_updated_at ON public.social_posts;
CREATE TRIGGER trg_social_posts_updated_at
  BEFORE UPDATE ON public.social_posts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- Listagem do feed social
-- =========================================================
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

-- =========================================================
-- Publicar post com mídia
-- =========================================================
DROP FUNCTION IF EXISTS public.rpc_app_publicar_social_post(uuid, text, text, text, text, text);

CREATE OR REPLACE FUNCTION public.rpc_app_publicar_social_post(
  p_artista_id UUID,
  p_body TEXT,
  p_media_url TEXT,
  p_media_type TEXT,
  p_thumbnail_url TEXT DEFAULT NULL,
  p_location TEXT DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  error TEXT,
  post_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_post_id UUID;
  v_url TEXT;
  v_tipo TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN QUERY SELECT false, 'Usuário não autenticado.', NULL::UUID;
    RETURN;
  END IF;

  v_url := NULLIF(trim(coalesce(p_media_url, '')), '');
  v_tipo := NULLIF(trim(coalesce(p_media_type, '')), '');

  IF v_url IS NULL THEN
    RETURN QUERY SELECT false, 'URL da mídia é obrigatória.', NULL::UUID;
    RETURN;
  END IF;

  IF v_tipo IS NULL OR v_tipo NOT IN ('image', 'video') THEN
    RETURN QUERY SELECT false, 'Tipo de mídia inválido.', NULL::UUID;
    RETURN;
  END IF;

  IF NOT public._is_member_of_artist(
    v_uid,
    p_artista_id,
    ARRAY['editor', 'vendedor', 'admin', 'owner']
  ) THEN
    RETURN QUERY SELECT false, 'Sem permissão para publicar neste artista.', NULL::UUID;
    RETURN;
  END IF;

  INSERT INTO public.social_posts (
    artist_id,
    body,
    location,
    is_published
  ) VALUES (
    p_artista_id,
    COALESCE(NULLIF(trim(coalesce(p_body, '')), ''), ''),
    NULLIF(trim(coalesce(p_location, '')), ''),
    true
  )
  RETURNING id INTO v_post_id;

  INSERT INTO public.social_post_media (
    post_id,
    media_type,
    media_url,
    thumbnail_url,
    sort_order
  ) VALUES (
    v_post_id,
    v_tipo,
    v_url,
    NULLIF(trim(coalesce(p_thumbnail_url, '')), ''),
    0
  );

  RETURN QUERY SELECT true, NULL::TEXT, v_post_id;
EXCEPTION
  WHEN OTHERS THEN
    RETURN QUERY SELECT false, SQLERRM, NULL::UUID;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_app_publicar_social_post(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- =========================================================
-- Remover post (oculta do feed)
-- =========================================================
DROP FUNCTION IF EXISTS public.rpc_app_remover_social_post(uuid);

CREATE OR REPLACE FUNCTION public.rpc_app_remover_social_post(
  p_post_id UUID
)
RETURNS TABLE (
  success BOOLEAN,
  error TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_post public.social_posts%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RETURN QUERY SELECT false, 'Usuário não autenticado.';
    RETURN;
  END IF;

  SELECT * INTO v_post
  FROM public.social_posts
  WHERE id = p_post_id
  LIMIT 1;

  IF v_post.id IS NULL OR v_post.is_published = false THEN
    RETURN QUERY SELECT false, 'Publicação não encontrada.';
    RETURN;
  END IF;

  IF NOT public._is_member_of_artist(
    v_uid,
    v_post.artist_id,
    ARRAY['editor', 'vendedor', 'admin', 'owner']
  ) THEN
    RETURN QUERY SELECT false, 'Sem permissão para remover esta publicação.';
    RETURN;
  END IF;

  UPDATE public.social_posts
  SET is_published = false
  WHERE id = v_post.id;

  RETURN QUERY SELECT true, NULL::TEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_app_remover_social_post(UUID) TO authenticated;

-- =========================================================
-- Curtir / descurtir post
-- =========================================================
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

-- =========================================================
-- Listar comentários do post
-- =========================================================
DROP FUNCTION IF EXISTS public.listar_comentarios_social_post(uuid);
DROP FUNCTION IF EXISTS public.listar_comentarios_social_post(uuid, uuid);

CREATE OR REPLACE FUNCTION public.listar_comentarios_social_post(
  p_post_id UUID,
  p_artista_atual_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  post_id UUID,
  artist_id UUID,
  artist_name TEXT,
  artist_image TEXT,
  message TEXT,
  created_at TIMESTAMPTZ,
  likes_count INTEGER,
  liked_by_me BOOLEAN
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
    spc.created_at,
    (
      SELECT COUNT(*)::integer
      FROM public.social_post_comment_likes spcl
      WHERE spcl.comment_id = spc.id
    ),
    (
      p_artista_atual_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.social_post_comment_likes spcl_me
        WHERE spcl_me.comment_id = spc.id
          AND spcl_me.artist_id = p_artista_atual_id
      )
    )
  FROM public.social_post_comments spc
  INNER JOIN public.artists a ON a.id = spc.artist_id
  INNER JOIN public.social_posts sp ON sp.id = spc.post_id
  WHERE spc.post_id = p_post_id
    AND sp.is_published = true
  ORDER BY spc.created_at ASC
  LIMIT 200;
$$;

GRANT EXECUTE ON FUNCTION public.listar_comentarios_social_post(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.listar_comentarios_social_post(UUID, UUID) TO service_role;

-- =========================================================
-- Curtir / descurtir comentário
-- =========================================================
DROP FUNCTION IF EXISTS public.rpc_app_alternar_curtida_social_comentario(uuid, uuid);

CREATE OR REPLACE FUNCTION public.rpc_app_alternar_curtida_social_comentario(
  p_comment_id UUID,
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
  v_comment public.social_post_comments%ROWTYPE;
  v_liked BOOLEAN;
  v_count INTEGER;
BEGIN
  IF v_uid IS NULL THEN
    RETURN QUERY SELECT false, 'Usuário não autenticado.', false, 0;
    RETURN;
  END IF;

  SELECT spc.* INTO v_comment
  FROM public.social_post_comments spc
  INNER JOIN public.social_posts sp ON sp.id = spc.post_id
  WHERE spc.id = p_comment_id
    AND sp.is_published = true
  LIMIT 1;

  IF v_comment.id IS NULL THEN
    RETURN QUERY SELECT false, 'Comentário não encontrado.', false, 0;
    RETURN;
  END IF;

  IF NOT public._is_member_of_artist(v_uid, p_artista_id, NULL) THEN
    RETURN QUERY SELECT false, 'Sem permissão para curtir neste artista.', false, 0;
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.social_post_comment_likes spcl
    WHERE spcl.comment_id = p_comment_id
      AND spcl.artist_id = p_artista_id
  ) THEN
    DELETE FROM public.social_post_comment_likes
    WHERE comment_id = p_comment_id
      AND artist_id = p_artista_id;
    v_liked := false;
  ELSE
    INSERT INTO public.social_post_comment_likes (comment_id, artist_id)
    VALUES (p_comment_id, p_artista_id)
    ON CONFLICT (comment_id, artist_id) DO NOTHING;
    v_liked := true;
  END IF;

  SELECT COUNT(*)::integer INTO v_count
  FROM public.social_post_comment_likes
  WHERE comment_id = p_comment_id;

  RETURN QUERY SELECT true, NULL::TEXT, v_liked, v_count;
EXCEPTION
  WHEN OTHERS THEN
    RETURN QUERY SELECT false, SQLERRM, false, 0;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_app_alternar_curtida_social_comentario(UUID, UUID) TO authenticated;

-- =========================================================
-- Comentar no post
-- =========================================================
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

-- =========================================================
-- Storage: bucket feed_media
-- Caminho no app: `{user_id}/{artist_id}/arquivo.ext`
-- =========================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'feed_media',
  'feed_media',
  true,
  104857600,
  NULL
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit;

DROP POLICY IF EXISTS "feed_media_public_read" ON storage.objects;
CREATE POLICY "feed_media_public_read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'feed_media');

DROP POLICY IF EXISTS "feed_media_insert_own_prefix" ON storage.objects;
CREATE POLICY "feed_media_insert_own_prefix"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'feed_media'
    AND (storage.foldername(name))[1] = (SELECT (auth.jwt() ->> 'sub'))
  );

DROP POLICY IF EXISTS "feed_media_delete_own_prefix" ON storage.objects;
CREATE POLICY "feed_media_delete_own_prefix"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'feed_media'
    AND (storage.foldername(name))[1] = (SELECT (auth.jwt() ->> 'sub'))
  );

NOTIFY pgrst, 'reload schema';

SELECT
  p.proname AS funcao,
  pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'listar_feed_social',
    'rpc_app_publicar_social_post',
    'rpc_app_remover_social_post',
    'rpc_app_alternar_curtida_social_post',
    'listar_comentarios_social_post',
    'rpc_app_alternar_curtida_social_comentario',
    'rpc_app_comentar_social_post'
  )
ORDER BY 1;
