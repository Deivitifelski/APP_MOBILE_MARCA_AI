-- Meta de receita do mês por artista (compartilhada entre todos os membros).
-- Execute no SQL Editor do Supabase após revisar nomes de schema/tabelas.

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS artist_month_revenue_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id UUID NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
  year SMALLINT NOT NULL CHECK (year >= 2000 AND year <= 2100),
  month SMALLINT NOT NULL CHECK (month >= 0 AND month <= 11),
  goal_amount NUMERIC(12,2) NOT NULL CHECK (goal_amount > 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (artist_id, year, month)
);

CREATE INDEX IF NOT EXISTS idx_artist_month_revenue_goals_artist
  ON artist_month_revenue_goals(artist_id);

COMMENT ON TABLE artist_month_revenue_goals IS 'Meta de receita mensal do artista; visível a todos os membros; edição por editor/admin/owner.';

DROP TRIGGER IF EXISTS trg_artist_month_revenue_goals_updated_at ON artist_month_revenue_goals;
CREATE TRIGGER trg_artist_month_revenue_goals_updated_at
  BEFORE UPDATE ON artist_month_revenue_goals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE artist_month_revenue_goals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS artist_month_goal_select ON artist_month_revenue_goals;
DROP POLICY IF EXISTS artist_month_goal_insert ON artist_month_revenue_goals;
DROP POLICY IF EXISTS artist_month_goal_update ON artist_month_revenue_goals;
DROP POLICY IF EXISTS artist_month_goal_delete ON artist_month_revenue_goals;

-- Qualquer membro do artista pode ver a meta
CREATE POLICY artist_month_goal_select ON artist_month_revenue_goals
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM artist_members am
      WHERE am.artist_id = artist_month_revenue_goals.artist_id
        AND am.user_id = auth.uid()
    )
  );

-- Editor, admin e owner podem criar/atualizar/remover
CREATE POLICY artist_month_goal_insert ON artist_month_revenue_goals
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM artist_members am
      WHERE am.artist_id = artist_month_revenue_goals.artist_id
        AND am.user_id = auth.uid()
        AND am.role IN ('editor', 'admin', 'owner')
    )
  );

CREATE POLICY artist_month_goal_update ON artist_month_revenue_goals
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM artist_members am
      WHERE am.artist_id = artist_month_revenue_goals.artist_id
        AND am.user_id = auth.uid()
        AND am.role IN ('editor', 'admin', 'owner')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM artist_members am
      WHERE am.artist_id = artist_month_revenue_goals.artist_id
        AND am.user_id = auth.uid()
        AND am.role IN ('editor', 'admin', 'owner')
    )
  );

CREATE POLICY artist_month_goal_delete ON artist_month_revenue_goals
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM artist_members am
      WHERE am.artist_id = artist_month_revenue_goals.artist_id
        AND am.user_id = auth.uid()
        AND am.role IN ('editor', 'admin', 'owner')
    )
  );
