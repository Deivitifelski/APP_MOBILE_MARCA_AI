-- =====================================================
-- TESTE: Verificar se usuário está na tabela artist_members
-- =====================================================

-- 1. Verificar usuário atual
SELECT auth.uid() as current_user_id;

-- 2. Verificar se o usuário está na tabela artist_members
SELECT 
  am.user_id,
  am.artist_id,
  am.role,
  a.name as artist_name
FROM artist_members am
LEFT JOIN artists a ON a.id = am.artist_id
WHERE am.user_id = auth.uid();

-- 3. Verificar se existem artistas na tabela artists
SELECT 
  id,
  name,
  created_at
FROM artists
ORDER BY created_at DESC
LIMIT 10;

-- 4. Verificar se existem membros na tabela artist_members
SELECT 
  user_id,
  artist_id,
  role,
  created_at
FROM artist_members
ORDER BY created_at DESC
LIMIT 10;

-- 5. Testar a função user_has_access
SELECT 
  user_has_access(auth.uid(), 'SEU_ARTIST_ID_AQUI', ARRAY['viewer', 'editor', 'admin', 'owner']) as has_access;

-- 6. Verificar políticas RLS
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN ('artists', 'artist_members')
AND schemaname = 'public';
