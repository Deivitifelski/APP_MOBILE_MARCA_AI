-- =====================================================
-- TESTE: Tentar criar artista diretamente no SQL
-- =====================================================

-- 1. Verificar usuário atual
SELECT auth.uid() as current_user_id;

-- 2. Tentar inserir um artista de teste
INSERT INTO artists (name, profile_url, created_at, updated_at)
VALUES ('Artista Teste', null, now(), now())
RETURNING *;

-- 3. Se funcionou, deletar o teste
DELETE FROM artists WHERE name = 'Artista Teste';

-- 4. Verificar se a tabela artist_members existe
SELECT COUNT(*) as total_members FROM artist_members;

-- 5. Verificar estrutura da tabela artist_members
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'artist_members' 
ORDER BY ordinal_position;
