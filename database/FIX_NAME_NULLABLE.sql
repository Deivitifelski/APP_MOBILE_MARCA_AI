-- ========================================
-- FIX: Tornar campo NAME opcional
-- Solução para erro "name cannot be null"
-- ========================================

-- ⚠️ Execute este script se estiver recebendo erro:
-- "null value in column 'name' violates not-null constraint"

-- Tornar o campo 'name' opcional (nullable)
ALTER TABLE event_expenses 
ALTER COLUMN name DROP NOT NULL;

-- Verificar se funcionou
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'event_expenses' 
    AND column_name = 'name' 
    AND is_nullable = 'YES'
  ) THEN
    RAISE NOTICE '✅ Campo "name" agora é opcional!';
    RAISE NOTICE 'Agora você pode criar despesas avulsas sem erro.';
  ELSE
    RAISE NOTICE '❌ Erro: Campo "name" ainda é obrigatório.';
  END IF;
END $$;

