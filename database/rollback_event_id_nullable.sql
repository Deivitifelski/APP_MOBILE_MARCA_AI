-- ========================================
-- ROLLBACK: Reverter Migration
-- Volta a tabela event_expenses ao estado anterior
-- ========================================

-- ⚠️ ATENÇÃO: Este script remove as mudanças feitas pela migration
-- Execute apenas se quiser desfazer as alterações!

-- 1. Deletar despesas avulsas (event_id NULL) - CUIDADO!
-- Comente esta linha se quiser manter as despesas avulsas
DELETE FROM event_expenses WHERE event_id IS NULL;

-- 2. Tornar event_id e name obrigatórios novamente
ALTER TABLE event_expenses 
ALTER COLUMN event_id SET NOT NULL;

ALTER TABLE event_expenses 
ALTER COLUMN name SET NOT NULL;

-- 3. Remover campos adicionados pela migration

-- Remover: description
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'event_expenses' AND column_name = 'description'
  ) THEN
    ALTER TABLE event_expenses DROP COLUMN description;
  END IF;
END $$;

-- Remover: category
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'event_expenses' AND column_name = 'category'
  ) THEN
    ALTER TABLE event_expenses DROP COLUMN category;
  END IF;
END $$;

-- Remover: date
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'event_expenses' AND column_name = 'date'
  ) THEN
    ALTER TABLE event_expenses DROP COLUMN date;
  END IF;
END $$;

-- Remover: notes
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'event_expenses' AND column_name = 'notes'
  ) THEN
    ALTER TABLE event_expenses DROP COLUMN notes;
  END IF;
END $$;

-- 4. Remover índices criados pela migration

DROP INDEX IF EXISTS idx_event_expenses_standalone;
DROP INDEX IF EXISTS idx_event_expenses_category;

-- 5. Remover comentários
COMMENT ON COLUMN event_expenses.event_id IS NULL;

-- 6. Mensagem de conclusão
DO $$ 
BEGIN
  RAISE NOTICE '✅ Rollback concluído com sucesso!';
  RAISE NOTICE '⚠️  A tabela voltou ao estado anterior';
  RAISE NOTICE '⚠️  Despesas avulsas foram removidas (se existirem)';
END $$;

