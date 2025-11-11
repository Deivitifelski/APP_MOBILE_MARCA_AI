-- ========================================
-- MIGRATION: Tornar event_id opcional
-- Permite despesas avulsas (sem evento)
-- ========================================

-- 1. Tornar event_id e name opcionais (permitir NULL)
ALTER TABLE event_expenses 
ALTER COLUMN event_id DROP NOT NULL;

ALTER TABLE event_expenses 
ALTER COLUMN name DROP NOT NULL;

-- 2. Adicionar novos campos para despesas avulsas (se não existirem)

-- Campo: description (descrição para despesas avulsas)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'event_expenses' AND column_name = 'description'
  ) THEN
    ALTER TABLE event_expenses ADD COLUMN description TEXT;
  END IF;
END $$;

-- Campo: category (categoria da despesa)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'event_expenses' AND column_name = 'category'
  ) THEN
    ALTER TABLE event_expenses ADD COLUMN category VARCHAR(50);
  END IF;
END $$;

-- Campo: date (data da despesa avulsa)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'event_expenses' AND column_name = 'date'
  ) THEN
    ALTER TABLE event_expenses ADD COLUMN date DATE;
  END IF;
END $$;

-- Campo: notes (observações)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'event_expenses' AND column_name = 'notes'
  ) THEN
    ALTER TABLE event_expenses ADD COLUMN notes TEXT;
  END IF;
END $$;

-- Campo: artist_id (referência ao artista - se não existir)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'event_expenses' AND column_name = 'artist_id'
  ) THEN
    ALTER TABLE event_expenses ADD COLUMN artist_id UUID REFERENCES artists(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 3. Criar índices para melhorar performance

-- Índice para despesas avulsas (event_id IS NULL)
CREATE INDEX IF NOT EXISTS idx_event_expenses_standalone 
ON event_expenses(artist_id, date) 
WHERE event_id IS NULL;

-- Índice para busca por categoria
CREATE INDEX IF NOT EXISTS idx_event_expenses_category 
ON event_expenses(category) 
WHERE category IS NOT NULL;

-- 4. Comentários explicativos
COMMENT ON COLUMN event_expenses.event_id IS 'ID do evento (NULL para despesas avulsas não vinculadas a eventos)';
COMMENT ON COLUMN event_expenses.description IS 'Descrição detalhada da despesa avulsa';
COMMENT ON COLUMN event_expenses.category IS 'Categoria: equipamento, manutencao, transporte, software, marketing, outros';
COMMENT ON COLUMN event_expenses.date IS 'Data da despesa avulsa';
COMMENT ON COLUMN event_expenses.notes IS 'Observações adicionais sobre a despesa';

-- 5. Mensagem de sucesso
DO $$ 
BEGIN
  RAISE NOTICE '✅ Migration concluída com sucesso!';
  RAISE NOTICE 'Agora você pode criar despesas avulsas (sem event_id)';
END $$;

