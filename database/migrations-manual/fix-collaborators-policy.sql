-- =====================================================
-- CORREÇÃO: Política para listar todos os colaboradores
-- =====================================================

-- 1. REMOVER POLÍTICA RESTRITIVA ATUAL
-- =====================================================
DROP POLICY IF EXISTS members_select_own ON artist_members;

-- 2. CRIAR POLÍTICA QUE PERMITE VER TODOS OS MEMBROS DO ARTISTA
-- =====================================================

-- Usuários podem ver todos os membros dos artistas que eles fazem parte
CREATE POLICY members_select_artist ON artist_members
FOR SELECT
USING (
  -- O usuário deve ser membro do mesmo artista
  EXISTS (
    SELECT 1 FROM artist_members am2 
    WHERE am2.artist_id = artist_members.artist_id 
    AND am2.user_id = auth.uid()
  )
);

-- 3. MANTER POLÍTICAS DE ADMINISTRAÇÃO
-- =====================================================

-- Admins e owners podem gerenciar membros
DROP POLICY IF EXISTS admin_manage_members_insert ON artist_members;
CREATE POLICY admin_manage_members_insert ON artist_members
FOR INSERT
WITH CHECK (
  user_has_access(auth.uid(), artist_id, ARRAY['admin', 'owner'])
);

DROP POLICY IF EXISTS admin_manage_members_update ON artist_members;
CREATE POLICY admin_manage_members_update ON artist_members
FOR UPDATE
USING (
  user_has_access(auth.uid(), artist_id, ARRAY['admin', 'owner'])
);

DROP POLICY IF EXISTS admin_manage_members_delete ON artist_members;
CREATE POLICY admin_manage_members_delete ON artist_members
FOR DELETE
USING (
  user_has_access(auth.uid(), artist_id, ARRAY['admin', 'owner'])
);

-- =====================================================
-- FIM DA CORREÇÃO
-- =====================================================
