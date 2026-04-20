-- Desabilitar RLS completamente
ALTER TABLE artists DISABLE ROW LEVEL SECURITY;
ALTER TABLE artist_members DISABLE ROW LEVEL SECURITY;

-- Remover coluna user_id se existir
ALTER TABLE artists DROP COLUMN IF EXISTS user_id CASCADE;

-- Adicionar coluna musical_style se não existir  
ALTER TABLE artists ADD COLUMN IF NOT EXISTS musical_style TEXT;

-- Mostrar estrutura final
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'artists' ORDER BY ordinal_position;

