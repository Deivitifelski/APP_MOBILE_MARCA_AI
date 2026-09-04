-- =========================================================
-- POLÍTICAS DE SEGURANÇA DO FEED SOCIAL
-- RLS (Row Level Security) - Supabase
-- =========================================================

-- Desabilitar RLS nas tabelas sociais para MVP
-- (mais permissivo para facilitar testes iniciais)

ALTER TABLE public.social_posts DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_post_media DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_post_tags DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_post_likes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_post_comments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_post_saved DISABLE ROW LEVEL SECURITY;

-- =========================================================
-- ALTERNATIVA: Políticas RLS mais restritivas (se quiser segurança)
-- =========================================================

-- Descomente e use estes comandos se preferir RLS habilitado:

/*
-- 1) HABILITAR RLS
ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_post_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_post_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_post_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_post_saved ENABLE ROW LEVEL SECURITY;

-- 2) POLÍTICAS PARA social_posts
-- Qualquer um pode ler posts publicados
CREATE POLICY "Posts publicados são públicos"
  ON public.social_posts FOR SELECT
  USING (is_published = true);

-- Artista pode inserir seus próprios posts
CREATE POLICY "Artista pode criar posts"
  ON public.social_posts FOR INSERT
  WITH CHECK (artist_id IN (
    SELECT id FROM public.artists
    WHERE user_id = auth.uid()
  ));

-- Artista pode atualizar seus próprios posts
CREATE POLICY "Artista pode atualizar seus posts"
  ON public.social_posts FOR UPDATE
  USING (artist_id IN (
    SELECT id FROM public.artists
    WHERE user_id = auth.uid()
  ))
  WITH CHECK (artist_id IN (
    SELECT id FROM public.artists
    WHERE user_id = auth.uid()
  ));

-- Artista pode deletar seus próprios posts
CREATE POLICY "Artista pode deletar seus posts"
  ON public.social_posts FOR DELETE
  USING (artist_id IN (
    SELECT id FROM public.artists
    WHERE user_id = auth.uid()
  ));

-- 3) POLÍTICAS PARA social_post_media
CREATE POLICY "Mídia de posts públicos é acessível"
  ON public.social_post_media FOR SELECT
  USING (post_id IN (
    SELECT id FROM public.social_posts WHERE is_published = true
  ));

CREATE POLICY "Artista pode adicionar mídia aos seus posts"
  ON public.social_post_media FOR INSERT
  WITH CHECK (post_id IN (
    SELECT id FROM public.social_posts
    WHERE artist_id IN (
      SELECT id FROM public.artists WHERE user_id = auth.uid()
    )
  ));

-- 4) POLÍTICAS PARA social_post_tags
CREATE POLICY "Tags de posts públicos são acessíveis"
  ON public.social_post_tags FOR SELECT
  USING (post_id IN (
    SELECT id FROM public.social_posts WHERE is_published = true
  ));

CREATE POLICY "Artista pode adicionar tags aos seus posts"
  ON public.social_post_tags FOR INSERT
  WITH CHECK (post_id IN (
    SELECT id FROM public.social_posts
    WHERE artist_id IN (
      SELECT id FROM public.artists WHERE user_id = auth.uid()
    )
  ));

-- 5) POLÍTICAS PARA social_post_likes
CREATE POLICY "Likes são públicos"
  ON public.social_post_likes FOR SELECT
  USING (true);

CREATE POLICY "Artista pode dar like em posts"
  ON public.social_post_likes FOR INSERT
  WITH CHECK (artist_id IN (
    SELECT id FROM public.artists WHERE user_id = auth.uid()
  ));

CREATE POLICY "Artista pode remover seu próprio like"
  ON public.social_post_likes FOR DELETE
  USING (artist_id IN (
    SELECT id FROM public.artists WHERE user_id = auth.uid()
  ));

-- 6) POLÍTICAS PARA social_post_comments
CREATE POLICY "Comentários de posts públicos são visíveis"
  ON public.social_post_comments FOR SELECT
  USING (post_id IN (
    SELECT id FROM public.social_posts WHERE is_published = true
  ));

CREATE POLICY "Artista pode comentar em posts"
  ON public.social_post_comments FOR INSERT
  WITH CHECK (artist_id IN (
    SELECT id FROM public.artists WHERE user_id = auth.uid()
  ));

CREATE POLICY "Artista pode deletar seus próprios comentários"
  ON public.social_post_comments FOR DELETE
  USING (artist_id IN (
    SELECT id FROM public.artists WHERE user_id = auth.uid()
  ));

-- 7) POLÍTICAS PARA social_post_saved
CREATE POLICY "Artista pode ver seus posts salvos"
  ON public.social_post_saved FOR SELECT
  USING (artist_id IN (
    SELECT id FROM public.artists WHERE user_id = auth.uid()
  ));

CREATE POLICY "Artista pode salvar posts"
  ON public.social_post_saved FOR INSERT
  WITH CHECK (artist_id IN (
    SELECT id FROM public.artists WHERE user_id = auth.uid()
  ));

CREATE POLICY "Artista pode remover posts salvos"
  ON public.social_post_saved FOR DELETE
  USING (artist_id IN (
    SELECT id FROM public.artists WHERE user_id = auth.uid()
  ));
*/

-- =========================================================
-- POLÍTICAS ATIVAS DO FEED
-- O projeto relaciona usuários e artistas por artist_members.
-- Execute este bloco no SQL Editor do Supabase.
-- =========================================================

ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_post_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_post_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_post_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_post_saved ENABLE ROW LEVEL SECURITY;

-- Permite que o cliente receba novas postagens e mídias em tempo real.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_rel pr
    JOIN pg_class c ON c.oid = pr.prrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_publication p ON p.oid = pr.prpubid
    WHERE p.pubname = 'supabase_realtime'
      AND n.nspname = 'public'
      AND c.relname = 'social_posts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.social_posts;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_rel pr
    JOIN pg_class c ON c.oid = pr.prrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_publication p ON p.oid = pr.pubid
    WHERE p.pubname = 'supabase_realtime'
      AND n.nspname = 'public'
      AND c.relname = 'social_post_media'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.social_post_media;
  END IF;
END $$;

DROP POLICY IF EXISTS social_posts_public_read ON public.social_posts;
DROP POLICY IF EXISTS social_posts_member_insert ON public.social_posts;
DROP POLICY IF EXISTS social_posts_member_delete ON public.social_posts;
DROP POLICY IF EXISTS social_post_media_public_read ON public.social_post_media;
DROP POLICY IF EXISTS social_post_media_member_insert ON public.social_post_media;
DROP POLICY IF EXISTS social_post_tags_public_read ON public.social_post_tags;
DROP POLICY IF EXISTS social_post_tags_member_insert ON public.social_post_tags;
DROP POLICY IF EXISTS social_post_likes_public_read ON public.social_post_likes;
DROP POLICY IF EXISTS social_post_likes_member_insert ON public.social_post_likes;
DROP POLICY IF EXISTS social_post_likes_member_delete ON public.social_post_likes;
DROP POLICY IF EXISTS social_post_comments_public_read ON public.social_post_comments;
DROP POLICY IF EXISTS social_post_comments_member_insert ON public.social_post_comments;

CREATE POLICY social_posts_public_read
  ON public.social_posts FOR SELECT
  USING (is_published = true);

CREATE POLICY social_posts_member_insert
  ON public.social_posts FOR INSERT
  WITH CHECK (user_has_access(auth.uid(), artist_id, ARRAY['editor', 'admin', 'owner']));

CREATE POLICY social_posts_member_delete
  ON public.social_posts FOR DELETE
  USING (user_has_access(auth.uid(), artist_id, ARRAY['editor', 'admin', 'owner']));

CREATE POLICY social_post_media_public_read
  ON public.social_post_media FOR SELECT
  USING (post_id IN (SELECT id FROM public.social_posts WHERE is_published = true));

CREATE POLICY social_post_media_member_insert
  ON public.social_post_media FOR INSERT
  WITH CHECK (post_id IN (
    SELECT id FROM public.social_posts
    WHERE user_has_access(auth.uid(), artist_id, ARRAY['editor', 'admin', 'owner'])
  ));

CREATE POLICY social_post_tags_public_read
  ON public.social_post_tags FOR SELECT
  USING (post_id IN (SELECT id FROM public.social_posts WHERE is_published = true));

CREATE POLICY social_post_tags_member_insert
  ON public.social_post_tags FOR INSERT
  WITH CHECK (post_id IN (
    SELECT id FROM public.social_posts
    WHERE user_has_access(auth.uid(), artist_id, ARRAY['editor', 'admin', 'owner'])
  ));

CREATE POLICY social_post_likes_public_read
  ON public.social_post_likes FOR SELECT
  USING (true);

CREATE POLICY social_post_likes_member_insert
  ON public.social_post_likes FOR INSERT
  WITH CHECK (user_has_access(auth.uid(), artist_id, ARRAY['viewer', 'editor', 'admin', 'owner']));

CREATE POLICY social_post_likes_member_delete
  ON public.social_post_likes FOR DELETE
  USING (user_has_access(auth.uid(), artist_id, ARRAY['viewer', 'editor', 'admin', 'owner']));

CREATE POLICY social_post_comments_public_read
  ON public.social_post_comments FOR SELECT
  USING (post_id IN (SELECT id FROM public.social_posts WHERE is_published = true));

CREATE POLICY social_post_comments_member_insert
  ON public.social_post_comments FOR INSERT
  WITH CHECK (user_has_access(auth.uid(), artist_id, ARRAY['viewer', 'editor', 'admin', 'owner']));

-- O app envia arquivos para `feed` usando o nome do arquivo como caminho.
DROP POLICY IF EXISTS social_feed_storage_public_read ON storage.objects;
DROP POLICY IF EXISTS social_feed_storage_authenticated_insert ON storage.objects;
DROP POLICY IF EXISTS social_feed_storage_authenticated_delete ON storage.objects;

CREATE POLICY social_feed_storage_public_read
  ON storage.objects FOR SELECT
  USING (bucket_id = 'feed');

CREATE POLICY social_feed_storage_authenticated_insert
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'feed');

CREATE POLICY social_feed_storage_authenticated_delete
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'feed'
    AND EXISTS (
      SELECT 1
      FROM public.artists a
      WHERE storage.objects.name LIKE a.id::text || '%'
        AND user_has_access(auth.uid(), a.id, ARRAY['editor', 'admin', 'owner'])
    )
  );
