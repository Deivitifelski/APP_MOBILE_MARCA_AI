-- =====================================================
-- DEBUG: Verificar estado atual das políticas RLS
-- =====================================================

-- 1. Verificar se RLS está habilitado na tabela artists
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'artists';

-- 2. Listar todas as políticas da tabela artists
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'artists';

-- 3. Verificar se a tabela artists existe e tem dados
SELECT COUNT(*) as total_artists FROM artists;

-- 4. Verificar estrutura da tabela artists
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'artists' 
ORDER BY ordinal_position;

-- 5. Verificar se há triggers ou constraints
SELECT trigger_name, event_manipulation, action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'artists';
