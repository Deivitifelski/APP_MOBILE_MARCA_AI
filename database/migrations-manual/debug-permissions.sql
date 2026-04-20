-- =====================================================
-- DEBUG DE PERMISSÕES - Execute no Supabase SQL Editor
-- =====================================================

-- 1. Verificar se o usuário está na tabela artist_members
SELECT 
  am.user_id,
  am.artist_id,
  am.role,
  a.name as artist_name
FROM artist_members am
JOIN artists a ON a.id = am.artist_id
WHERE am.user_id = auth.uid();

-- 2. Testar a função user_has_access
SELECT 
  user_has_access(auth.uid(), 'SEU_ARTIST_ID_AQUI', ARRAY['viewer', 'editor', 'admin', 'owner']) as has_access;

-- 3. Verificar se RLS está habilitado
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN ('artists', 'events', 'artist_members')
AND schemaname = 'public';

-- 4. Verificar políticas existentes
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies 
WHERE tablename IN ('artists', 'events', 'artist_members')
AND schemaname = 'public';

-- 5. Testar consulta direta na tabela artists
SELECT * FROM artists WHERE id = 'SEU_ARTIST_ID_AQUI';

-- 6. Testar consulta direta na tabela events
SELECT * FROM events WHERE artist_id = 'SEU_ARTIST_ID_AQUI' LIMIT 5;
