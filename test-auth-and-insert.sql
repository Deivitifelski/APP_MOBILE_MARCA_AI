-- =====================================================
-- TESTE: Verificar autenticação e inserção
-- =====================================================

-- 1. Verificar usuário atual
SELECT auth.uid() as current_user_id;

-- 2. Verificar se o usuário está autenticado
SELECT auth.role() as current_role;

-- 3. Verificar se a tabela artists existe e está acessível
SELECT COUNT(*) as total_artists FROM artists;

-- 4. Tentar inserir um artista de teste com dados mínimos
INSERT INTO artists (name, created_at, updated_at)
VALUES ('Teste Debug', now(), now())
RETURNING *;

-- 5. Se funcionou, deletar o teste
DELETE FROM artists WHERE name = 'Teste Debug';

-- 6. Verificar se a tabela artist_members existe
SELECT COUNT(*) as total_members FROM artist_members;

-- 7. Verificar estrutura da tabela artists
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'artists' 
ORDER BY ordinal_position;

-- 8. Verificar se há constraints ou triggers
SELECT constraint_name, constraint_type, table_name
FROM information_schema.table_constraints 
WHERE table_name = 'artists';
