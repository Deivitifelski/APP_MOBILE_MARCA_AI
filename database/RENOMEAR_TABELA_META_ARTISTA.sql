-- Migração única: renomear artist_month_revenue_goals → meta_mensal_artista
-- Rode no Supabase SQL Editor SOMENTE se a tabela antiga já existir.
-- Em seguida rode database/ARTIST_MONTH_REVENUE_GOALS.sql (ele recria políticas com os novos nomes).

ALTER TABLE IF EXISTS artist_month_revenue_goals RENAME TO meta_mensal_artista;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'idx_artist_month_revenue_goals_artist'
      AND n.nspname = 'public'
  ) THEN
    ALTER INDEX idx_artist_month_revenue_goals_artist RENAME TO idx_meta_mensal_artista_artist;
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_artist_month_revenue_goals_updated_at ON meta_mensal_artista;
DROP TRIGGER IF EXISTS trg_meta_mensal_artista_updated_at ON meta_mensal_artista;
CREATE TRIGGER trg_meta_mensal_artista_updated_at
  BEFORE UPDATE ON meta_mensal_artista
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
