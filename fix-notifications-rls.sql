-- =====================================================
-- CORRIGIR RLS PARA TABELA NOTIFICATIONS
-- Execute no SQL Editor do Supabase
-- =====================================================

-- 1. Verificar se RLS está habilitado
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- 2. Remover políticas antigas (se existirem)
DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can insert their own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can insert notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can delete their own notifications" ON notifications;
DROP POLICY IF EXISTS "Allow authenticated users to insert notifications" ON notifications;

-- 3. CRIAR POLÍTICAS CORRETAS

-- SELECT: Usuários podem ver notificações que receberam ou enviaram
CREATE POLICY "Users can view their own notifications" ON notifications
FOR SELECT
USING (
  user_id = auth.uid() OR from_user_id = auth.uid()
);

-- INSERT: Qualquer usuário autenticado pode criar notificações
-- Isso permite que usuários criem notificações para outros usuários (como ao convidar colaboradores)
CREATE POLICY "Allow authenticated users to insert notifications" ON notifications
FOR INSERT
TO authenticated
WITH CHECK (true);

-- ✅ UPDATE: Usuários podem atualizar APENAS suas notificações recebidas (campo read)
CREATE POLICY "Users can update their own notifications" ON notifications
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- DELETE: Usuários podem deletar suas notificações recebidas
CREATE POLICY "Users can delete their own notifications" ON notifications
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- 4. Verificar se as políticas foram criadas
SELECT 
  policyname,
  cmd,
  roles,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'notifications'
ORDER BY cmd;

-- 5. Testar se consegue criar uma notificação (substitua os IDs pelos seus)
-- Descomente as linhas abaixo e coloque IDs válidos para testar:
/*
INSERT INTO notifications (user_id, title, message, type, read)
VALUES (
  'SEU_USER_ID_AQUI',
  'Teste de Notificação',
  'Se você conseguir ver isso, o RLS está funcionando!',
  'system',
  false
);
*/
