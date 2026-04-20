-- =====================================================
-- CORREÇÃO SIMPLES: Políticas para ARTIST_MEMBERS
-- =====================================================

-- 1. REMOVER POLÍTICA PROBLEMÁTICA
-- =====================================================
DROP POLICY IF EXISTS admin_manage_members ON artist_members;

-- 2. CRIAR POLÍTICA SIMPLES PARA SELECT
-- =====================================================

-- TODOS os membros podem ver suas próprias entradas
CREATE POLICY members_select_own ON artist_members
FOR SELECT
USING (
  user_id = auth.uid()
);

-- =====================================================
-- FIM DA CORREÇÃO SIMPLES
-- =====================================================
