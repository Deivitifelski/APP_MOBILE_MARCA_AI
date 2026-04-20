-- =====================================================
-- CORREÇÃO: Políticas para ARTIST_MEMBERS
-- =====================================================

-- 1. REMOVER POLÍTICA PROBLEMÁTICA
-- =====================================================
DROP POLICY IF EXISTS admin_manage_members ON artist_members;

-- 2. CRIAR POLÍTICAS CORRETAS PARA ARTIST_MEMBERS
-- =====================================================

-- TODOS os membros podem ver suas próprias entradas
CREATE POLICY members_select_own ON artist_members
FOR SELECT
USING (
  user_id = auth.uid()
);

-- ADMIN/OWNER: pode gerenciar membros (INSERT, UPDATE, DELETE)
CREATE POLICY admin_manage_members_insert ON artist_members
FOR INSERT
WITH CHECK (
  user_has_access(auth.uid(), artist_id, ARRAY['admin', 'owner'])
);

CREATE POLICY admin_manage_members_update ON artist_members
FOR UPDATE
USING (
  user_has_access(auth.uid(), artist_id, ARRAY['admin', 'owner'])
);

CREATE POLICY admin_manage_members_delete ON artist_members
FOR DELETE
USING (
  user_has_access(auth.uid(), artist_id, ARRAY['admin', 'owner'])
);

-- =====================================================
-- FIM DA CORREÇÃO
-- =====================================================
