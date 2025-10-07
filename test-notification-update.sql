-- Script para testar e verificar atualização de notificações
-- Execute no SQL Editor do Supabase

-- 1. Ver todas as políticas RLS da tabela notifications
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'notifications';

-- 2. Ver suas notificações não lidas
SELECT 
  id,
  user_id,
  title,
  read,
  created_at
FROM notifications
WHERE user_id = auth.uid()
  AND read = false
ORDER BY created_at DESC;

-- 3. Testar update manual (substitua o UUID pelo seu user_id)
-- Isso testa se você consegue atualizar as notificações manualmente
/*
UPDATE notifications
SET read = true
WHERE user_id = auth.uid()
  AND read = false;
*/

-- 4. Ver resultado após update
/*
SELECT 
  id,
  user_id,
  title,
  read,
  created_at
FROM notifications
WHERE user_id = auth.uid()
ORDER BY created_at DESC
LIMIT 10;
*/

-- 5. Se não houver política de UPDATE, criar uma:
/*
CREATE POLICY "Users can update their own notifications" ON notifications
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());
*/

