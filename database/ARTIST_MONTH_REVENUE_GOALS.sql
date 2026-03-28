-- Meta de receita do mês por artista (compartilhada entre todos os membros).
-- Tabela: meta_mensal_artista
-- Execute no SQL Editor do Supabase.
--
-- Se você JÁ tinha criado a tabela artist_month_revenue_goals, rode antes:
--   database/RENOMEAR_TABELA_META_ARTISTA.sql

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS meta_mensal_artista (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id UUID NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
  year SMALLINT NOT NULL CHECK (year >= 2000 AND year <= 2100),
  month SMALLINT NOT NULL CHECK (month >= 0 AND month <= 11),
  goal_amount NUMERIC(12,2) NOT NULL CHECK (goal_amount > 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (artist_id, year, month)
);

CREATE INDEX IF NOT EXISTS idx_meta_mensal_artista_artist
  ON meta_mensal_artista(artist_id);

COMMENT ON TABLE meta_mensal_artista IS 'Meta de receita mensal do artista; visível a todos os membros; edição por editor/admin/owner.';

DROP TRIGGER IF EXISTS trg_meta_mensal_artista_updated_at ON meta_mensal_artista;
CREATE TRIGGER trg_meta_mensal_artista_updated_at
  BEFORE UPDATE ON meta_mensal_artista
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE meta_mensal_artista ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS meta_mensal_artista_select ON meta_mensal_artista;
DROP POLICY IF EXISTS meta_mensal_artista_insert ON meta_mensal_artista;
DROP POLICY IF EXISTS meta_mensal_artista_update ON meta_mensal_artista;
DROP POLICY IF EXISTS meta_mensal_artista_delete ON meta_mensal_artista;
-- Nomes antigos (se o script anterior já foi aplicado com outra tabela)
DROP POLICY IF EXISTS artist_month_goal_select ON meta_mensal_artista;
DROP POLICY IF EXISTS artist_month_goal_insert ON meta_mensal_artista;
DROP POLICY IF EXISTS artist_month_goal_update ON meta_mensal_artista;
DROP POLICY IF EXISTS artist_month_goal_delete ON meta_mensal_artista;

CREATE POLICY meta_mensal_artista_select ON meta_mensal_artista
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM artist_members am
      WHERE am.artist_id = meta_mensal_artista.artist_id
        AND am.user_id = auth.uid()
    )
  );

CREATE POLICY meta_mensal_artista_insert ON meta_mensal_artista
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM artist_members am
      WHERE am.artist_id = meta_mensal_artista.artist_id
        AND am.user_id = auth.uid()
        AND am.role IN ('editor', 'admin', 'owner')
    )
  );

CREATE POLICY meta_mensal_artista_update ON meta_mensal_artista
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM artist_members am
      WHERE am.artist_id = meta_mensal_artista.artist_id
        AND am.user_id = auth.uid()
        AND am.role IN ('editor', 'admin', 'owner')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM artist_members am
      WHERE am.artist_id = meta_mensal_artista.artist_id
        AND am.user_id = auth.uid()
        AND am.role IN ('editor', 'admin', 'owner')
    )
  );

CREATE POLICY meta_mensal_artista_delete ON meta_mensal_artista
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM artist_members am
      WHERE am.artist_id = meta_mensal_artista.artist_id
        AND am.user_id = auth.uid()
        AND am.role IN ('editor', 'admin', 'owner')
    )
  );
