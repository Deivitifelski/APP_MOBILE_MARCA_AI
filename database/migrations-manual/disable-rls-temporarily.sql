-- =====================================================
-- SOLUÇÃO TEMPORÁRIA: Desabilitar RLS completamente
-- =====================================================

-- 1. DESABILITAR RLS COMPLETAMENTE PARA artist_members
-- =====================================================
ALTER TABLE artist_members DISABLE ROW LEVEL SECURITY;

-- 2. REMOVER TODAS AS POLÍTICAS EXISTENTES
-- =====================================================
DROP POLICY IF EXISTS members_select_own ON artist_members;
DROP POLICY IF EXISTS members_select_artist ON artist_members;
DROP POLICY IF EXISTS members_select_all ON artist_members;
DROP POLICY IF EXISTS members_select_all_collaborators ON artist_members;
DROP POLICY IF EXISTS admin_manage_members_insert ON artist_members;
DROP POLICY IF EXISTS admin_manage_members_update ON artist_members;
DROP POLICY IF EXISTS admin_manage_members_delete ON artist_members;
DROP POLICY IF EXISTS members_insert_owner ON artist_members;
DROP POLICY IF EXISTS members_update_owner ON artist_members;
DROP POLICY IF EXISTS members_delete_owner ON artist_members;
DROP POLICY IF EXISTS members_insert_admin_owner ON artist_members;
DROP POLICY IF EXISTS members_update_admin_owner ON artist_members;
DROP POLICY IF EXISTS members_delete_admin_owner ON artist_members;

-- =====================================================
-- NOTA: RLS está desabilitado temporariamente
-- A segurança será implementada no código da aplicação
-- =====================================================
