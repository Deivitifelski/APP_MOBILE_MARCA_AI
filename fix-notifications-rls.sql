-- =====================================================
-- CORRIGIR RLS PARA TABELA NOTIFICATIONS
-- Execute no SQL Editor do Supabase
-- =====================================================

-- 1. Verificar se RLS está habilitado
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- 2. Remover políticas antigas (se existirem)
DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can insert their own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can delete their own notifications" ON notifications;

-- 3. CRIAR POLÍTICAS CORRETAS

-- SELECT: Usuários podem ver notificações que receberam ou enviaram
CREATE POLICY "Users can view their own notifications" ON notifications
FOR SELECT
USING (
  user_id = auth.uid() OR from_user_id = auth.uid()
);

-- INSERT: Qualquer usuário autenticado pode criar notificações
CREATE POLICY "Users can insert notifications" ON notifications
FOR INSERT
WITH CHECK (true);

-- ✅ UPDATE: Usuários podem atualizar APENAS suas notificações recebidas (campo read)
CREATE POLICY "Users can update their own notifications" ON notifications
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- DELETE: Usuários podem deletar suas notificações recebidas
CREATE POLICY "Users can delete their own notifications" ON notifications
FOR DELETE
USING (user_id = auth.uid());

-- 4. Verificar se as políticas foram criadas
SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'notifications';

