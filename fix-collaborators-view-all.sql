-- =====================================================
-- CORREÇÃO: Permitir visualização para todos, edição apenas para admins/owners
-- =====================================================

-- 1. DESABILITAR RLS TEMPORARIAMENTE
-- =====================================================
ALTER TABLE artist_members DISABLE ROW LEVEL SECURITY;

-- 2. REMOVER TODAS AS POLÍTICAS EXISTENTES
-- =====================================================
DROP POLICY IF EXISTS members_select_own ON artist_members;
DROP POLICY IF EXISTS members_select_artist ON artist_members;
DROP POLICY IF EXISTS members_select_all ON artist_members;
DROP POLICY IF EXISTS admin_manage_members_insert ON artist_members;
DROP POLICY IF EXISTS admin_manage_members_update ON artist_members;
DROP POLICY IF EXISTS admin_manage_members_delete ON artist_members;
DROP POLICY IF EXISTS members_insert_owner ON artist_members;
DROP POLICY IF EXISTS members_update_owner ON artist_members;
DROP POLICY IF EXISTS members_delete_owner ON artist_members;

-- 3. HABILITAR RLS NOVAMENTE
-- =====================================================
ALTER TABLE artist_members ENABLE ROW LEVEL SECURITY;

-- 4. CRIAR POLÍTICAS PARA VISUALIZAÇÃO E EDIÇÃO
-- =====================================================

-- Política para SELECT: TODOS os membros podem ver TODOS os colaboradores do artista
CREATE POLICY members_select_all_collaborators ON artist_members
FOR SELECT
USING (
  -- O usuário deve ser membro do artista (qualquer role)
  EXISTS (
    SELECT 1 FROM artist_members am 
    WHERE am.artist_id = artist_members.artist_id 
    AND am.user_id = auth.uid()
  )
);

-- Política para INSERT: apenas owners e admins podem adicionar membros
CREATE POLICY members_insert_admin_owner ON artist_members
FOR INSERT
WITH CHECK (
  -- Verificar se o usuário é owner ou admin do artista
  EXISTS (
    SELECT 1 FROM artist_members am 
    WHERE am.artist_id = artist_members.artist_id 
    AND am.user_id = auth.uid() 
    AND am.role IN ('owner', 'admin')
  )
);

-- Política para UPDATE: apenas owners e admins podem atualizar
CREATE POLICY members_update_admin_owner ON artist_members
FOR UPDATE
USING (
  -- Verificar se o usuário é owner ou admin do artista
  EXISTS (
    SELECT 1 FROM artist_members am 
    WHERE am.artist_id = artist_members.artist_id 
    AND am.user_id = auth.uid() 
    AND am.role IN ('owner', 'admin')
  )
);

-- Política para DELETE: apenas owners e admins podem remover
CREATE POLICY members_delete_admin_owner ON artist_members
FOR DELETE
USING (
  -- Verificar se o usuário é owner ou admin do artista
  EXISTS (
    SELECT 1 FROM artist_members am 
    WHERE am.artist_id = artist_members.artist_id 
    AND am.user_id = auth.uid() 
    AND am.role IN ('owner', 'admin')
  )
);

-- =====================================================
-- FIM DA CORREÇÃO
-- =====================================================
