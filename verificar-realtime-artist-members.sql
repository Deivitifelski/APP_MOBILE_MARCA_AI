-- =====================================================
-- VERIFICAR E HABILITAR REALTIME EM artist_members
-- Execute no SQL Editor do Supabase
-- =====================================================

-- 1. Verificar se Realtime está habilitado na tabela
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE tablename = 'artist_members';

-- 2. Verificar réplica de Realtime
SELECT 
  * 
FROM pg_publication_tables 
WHERE tablename = 'artist_members';

-- 3. ✅ HABILITAR REALTIME (se não estiver habilitado)
-- No Dashboard do Supabase:
-- Database → Replication → Selecione "artist_members" → Enable

-- Ou execute este SQL se tiver permissão:
-- ALTER PUBLICATION supabase_realtime ADD TABLE artist_members;

-- 4. Verificar políticas RLS que podem estar bloqueando SELECT
SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'artist_members';

-- 5. Ver seus registros em artist_members
SELECT 
  am.*,
  u.email as user_email,
  a.name as artist_name
FROM artist_members am
LEFT JOIN users u ON u.id = am.user_id
LEFT JOIN artists a ON a.id = am.artist_id
WHERE am.user_id = auth.uid()
ORDER BY am.created_at DESC;

-- 6. Testar UPDATE manual para ver se funciona
/*
UPDATE artist_members
SET role = 'viewer'
WHERE user_id = auth.uid()
  AND artist_id = 'SEU_ARTIST_ID_AQUI';
*/

-- 7. Verificar se mudou
/*
SELECT role
FROM artist_members
WHERE user_id = auth.uid()
ORDER BY created_at DESC
LIMIT 1;
*/

