-- Materiais de identidade visual / press kit por artista (links e arquivos no Storage).
-- Execute no SQL Editor do Supabase (ou migração).

CREATE TABLE IF NOT EXISTS public.artist_press_kit_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id UUID NOT NULL REFERENCES public.artists(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL CHECK (item_type IN ('link', 'file')),
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  storage_path TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_artist_press_kit_items_artist
  ON public.artist_press_kit_items (artist_id, sort_order, created_at);

COMMENT ON TABLE public.artist_press_kit_items IS 'Logos, capas, links de press kit e arquivos públicos do artista';

ALTER TABLE public.artist_press_kit_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "artist_press_kit_select_members" ON public.artist_press_kit_items;
CREATE POLICY "artist_press_kit_select_members"
  ON public.artist_press_kit_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.artist_members am
      WHERE am.artist_id = artist_press_kit_items.artist_id
        AND am.user_id = auth.uid()
    )
  );

-- INSERT: administrador do artista OU membro com assinatura ativa (RPC user_subscription_is_active).
DROP POLICY IF EXISTS "artist_press_kit_insert_admin" ON public.artist_press_kit_items;
DROP POLICY IF EXISTS "artist_press_kit_insert_admin_or_subscriber" ON public.artist_press_kit_items;
CREATE POLICY "artist_press_kit_insert_admin_or_subscriber"
  ON public.artist_press_kit_items
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.artist_members am
      WHERE am.artist_id = artist_press_kit_items.artist_id
        AND am.user_id = auth.uid()
    )
    AND (
      EXISTS (
        SELECT 1 FROM public.artist_members am2
        WHERE am2.artist_id = artist_press_kit_items.artist_id
          AND am2.user_id = auth.uid()
          AND am2.role = 'admin'
      )
      OR public.user_subscription_is_active(auth.uid()) IS TRUE
    )
  );

DROP POLICY IF EXISTS "artist_press_kit_update_admin" ON public.artist_press_kit_items;
CREATE POLICY "artist_press_kit_update_admin"
  ON public.artist_press_kit_items
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.artist_members am
      WHERE am.artist_id = artist_press_kit_items.artist_id
        AND am.user_id = auth.uid()
        AND am.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.artist_members am
      WHERE am.artist_id = artist_press_kit_items.artist_id
        AND am.user_id = auth.uid()
        AND am.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "artist_press_kit_delete_admin" ON public.artist_press_kit_items;
CREATE POLICY "artist_press_kit_delete_admin"
  ON public.artist_press_kit_items
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.artist_members am
      WHERE am.artist_id = artist_press_kit_items.artist_id
        AND am.user_id = auth.uid()
        AND am.role = 'admin'
    )
  );

-- Arquivos: bucket Storage `press_kit` (público, com RLS em storage.objects).
-- Caminho no app (bucket press_kit): {user_id}/press_kit/{artist_id}/{arquivo}
-- Execute database/STORAGE_PRESS_KIT_BUCKET.sql no Supabase após criar o projeto / bucket.
