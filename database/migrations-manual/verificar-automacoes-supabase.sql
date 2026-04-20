-- =====================================================
-- VERIFICAR TODAS AS AUTOMAÇÕES DO SUPABASE
-- =====================================================

-- 1. Listar TODOS os triggers do banco
SELECT 
  schemaname,
  tablename,
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
FROM information_schema.triggers
WHERE schemaname = 'public'
ORDER BY tablename, trigger_name;

-- 2. Listar TODAS as functions do banco
SELECT 
  routine_schema,
  routine_name,
  data_type,
  routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_type = 'FUNCTION'
ORDER BY routine_name;

-- 3. Verificar especificamente por functions que inserem em notifications
SELECT 
  routine_name,
  routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_type = 'FUNCTION'
  AND routine_definition ILIKE '%INSERT INTO notifications%'
ORDER BY routine_name;

-- 4. Verificar triggers na tabela notifications
SELECT 
  trigger_name,
  event_manipulation,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'notifications'
ORDER BY trigger_name;

-- 5. Verificar se há webhook configurado (via extensão pg_net se instalada)
-- Nota: Isso só funciona se a extensão pg_net estiver instalada
/*
SELECT * FROM net._http_response 
WHERE created_at > NOW() - INTERVAL '1 day'
ORDER BY created_at DESC
LIMIT 10;
*/

