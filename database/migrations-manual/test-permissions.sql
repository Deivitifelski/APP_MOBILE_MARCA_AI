-- =====================================================
-- TESTE DE PERMISSÕES - Execute após aplicar as políticas
-- =====================================================

-- 1. Verificar se RLS está habilitado
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN ('artists', 'events', 'finances', 'artist_members')
AND schemaname = 'public';

-- 2. Verificar se as funções foram criadas
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_name IN ('get_user_role', 'user_has_access', 'get_events_by_role')
AND routine_schema = 'public';

-- 3. Verificar se as políticas foram criadas
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies 
WHERE tablename IN ('artists', 'events', 'finances', 'artist_members')
AND schemaname = 'public';

-- 4. Verificar se as views foram criadas
SELECT table_name, table_type 
FROM information_schema.tables 
WHERE table_name IN ('public_events', 'full_events')
AND table_schema = 'public';

-- 5. Teste básico de permissão (substitua pelos seus IDs)
-- SELECT get_user_role('SEU_USER_ID_AQUI', 'SEU_ARTIST_ID_AQUI');
-- SELECT user_has_access('SEU_USER_ID_AQUI', 'SEU_ARTIST_ID_AQUI', ARRAY['viewer']);
