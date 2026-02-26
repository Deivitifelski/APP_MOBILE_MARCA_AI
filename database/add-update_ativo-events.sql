-- Adiciona coluna update_ativo em events (momento em que ativo foi setado para false).
-- Garante coluna ativo se ainda não existir (soft delete).
-- Rodar no SQL Editor do Supabase.

-- Coluna ativo (soft delete): true = visível, false = "deletado"
ALTER TABLE events ADD COLUMN IF NOT EXISTS ativo BOOLEAN DEFAULT true;
UPDATE events SET ativo = true WHERE ativo IS NULL;

-- Coluna update_ativo: timestamp em que o evento foi desativado (ativo = false)
ALTER TABLE events ADD COLUMN IF NOT EXISTS update_ativo TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN events.ativo IS 'false = evento excluído (soft delete)';
COMMENT ON COLUMN events.update_ativo IS 'Momento em que ativo foi alterado para false (exclusão lógica)';
