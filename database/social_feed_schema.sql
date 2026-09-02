-- =========================================================
-- SCHEMA DO FEED SOCIAL DO MARCA AI
-- Baseado no artista como dono do conteúdo
-- Curtidas e comentários vinculados ao usuário logado
-- =========================================================

-- 1) POSTS DO ARTISTA
CREATE TABLE IF NOT EXISTS public.social_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id uuid NOT NULL REFERENCES public.artists(id) ON DELETE CASCADE,
  body text,
  location text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  is_published boolean NOT NULL DEFAULT true
);

-- A legenda é opcional quando o post contém apenas imagem ou vídeo.
ALTER TABLE public.social_posts
  ALTER COLUMN body DROP NOT NULL;

-- 2) MIDIA DO POST (imagem ou vídeo)
CREATE TABLE IF NOT EXISTS public.social_post_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.social_posts(id) ON DELETE CASCADE,
  media_type text NOT NULL CHECK (media_type IN ('image', 'video')),
  media_url text NOT NULL,
  thumbnail_url text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3) TAGS DO POST
CREATE TABLE IF NOT EXISTS public.social_post_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.social_posts(id) ON DELETE CASCADE,
  tag text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 4) CURTIDAS DO POST
-- Sempre do artista, nunca do usuário comum.
CREATE TABLE IF NOT EXISTS public.social_post_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.social_posts(id) ON DELETE CASCADE,
  artist_id uuid NOT NULL REFERENCES public.artists(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, artist_id)
);

-- 5) COMENTÁRIOS DO POST
-- Sempre do artista, nunca do usuário comum.
CREATE TABLE IF NOT EXISTS public.social_post_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.social_posts(id) ON DELETE CASCADE,
  artist_id uuid NOT NULL REFERENCES public.artists(id) ON DELETE CASCADE,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 6) SALVOS / FAVORITOS DO ARTISTA (opcional)
CREATE TABLE IF NOT EXISTS public.social_post_saved (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.social_posts(id) ON DELETE CASCADE,
  artist_id uuid NOT NULL REFERENCES public.artists(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, artist_id)
);

-- ==============================================
-- ÍNDICES PARA PERFORMANCE
-- ==============================================
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

CREATE INDEX IF NOT EXISTS idx_social_post_saved_post_id
    ON public.social_post_saved (post_id);

CREATE INDEX IF NOT EXISTS idx_social_post_saved_artist_id
    ON public.social_post_saved (artist_id);

-- ==============================================
-- FUNÇÃO PARA ATUALIZAR updated_at AUTOMATICAMENTE
-- ==============================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_social_posts_updated_at
BEFORE UPDATE ON public.social_posts
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- ==============================================
-- DADOS DE EXEMPLO
-- ==============================================
-- Exemplo de inserção de post:
-- INSERT INTO public.social_posts (artist_id, body, location, is_published)
-- VALUES ('ARTIST_ID_AQUI', 'Festa íntima, luz baixa e uma música nova que nasceu do improviso. Vem ouvir comigo.', 'Belo Horizonte, MG', true);
--
-- Exemplo de mídia:
-- INSERT INTO public.social_post_media (post_id, media_type, media_url, thumbnail_url, sort_order)
-- VALUES ('POST_ID_AQUI', 'image', 'https://...', 'https://...', 0);
--
-- Exemplo de tag:
-- INSERT INTO public.social_post_tags (post_id, tag)
-- VALUES ('POST_ID_AQUI', '#live'), ('POST_ID_AQUI', '#soul');
--
-- Exemplo de curtida do artista:
-- INSERT INTO public.social_post_likes (post_id, artist_id)
-- VALUES ('POST_ID_AQUI', 'ARTIST_ID_AQUI');
--
-- Exemplo de comentário do artista:
-- INSERT INTO public.social_post_comments (post_id, artist_id, message)
-- VALUES ('POST_ID_AQUI', 'ARTIST_ID_AQUI', 'A música ficou incrível!');

-- ==============================================
-- QUERY BASE DO FEED
-- ==============================================
-- SELECT
--   sp.id,
--   sp.body,
--   sp.location,
--   sp.created_at,
--   a.id AS artist_id,
--   a.name AS artist_name,
--   a.profile_url AS artist_avatar,
--   a.city,
--   a.state,
--   a.musical_style,
--   (
--     SELECT count(*)
--     FROM public.social_post_likes spl
--     WHERE spl.post_id = sp.id
--   ) AS likes_count,
--   (
--     SELECT count(*)
--     FROM public.social_post_comments spc
--     WHERE spc.post_id = sp.id
--   ) AS comments_count,
--   (
--     SELECT json_agg(
--       json_build_object(
--         'media_type', spm.media_type,
--         'media_url', spm.media_url,
--         'thumbnail_url', spm.thumbnail_url
--       ) ORDER BY spm.sort_order
--     )
--     FROM public.social_post_media spm
--     WHERE spm.post_id = sp.id
--   ) AS media,
--   (
--     SELECT json_agg(spt.tag)
--     FROM public.social_post_tags spt
--     WHERE spt.post_id = sp.id
--   ) AS tags
-- FROM public.social_posts sp
-- JOIN public.artists a ON a.id = sp.artist_id
-- WHERE sp.is_published = true
-- ORDER BY sp.created_at DESC
-- LIMIT 20;
