-- =====================================================
-- POLÍTICAS RLS CORRETAS PARA artist_members
-- =====================================================

-- REGRAS:
-- 1. ADMIN pode alterar/remover TODOS (owner, admin, editor, viewer) - menos ele mesmo
-- 2. OWNER pode alterar/remover apenas EDITOR e VIEWER (não pode mexer em admin/owner)
-- 3. Ninguém pode alterar/remover a si mesmo

-- Remover políticas antigas
DROP POLICY IF EXISTS prevent_admin_role_change ON artist_members;
DROP POLICY IF EXISTS prevent_admin_delete ON artist_members;

-- =====================================================
-- POLÍTICA DE UPDATE (Alterar Permissões)
-- =====================================================

CREATE POLICY manage_artist_members_update ON artist_members
  FOR UPDATE
  USING (
    -- Permitir UPDATE se:
    EXISTS (
      SELECT 1 
      FROM artist_members requester
      WHERE requester.user_id = auth.uid()
        AND requester.artist_id = artist_members.artist_id
        AND (
          -- ADMIN pode alterar qualquer um
          requester.role = 'admin'
          OR
          -- OWNER pode alterar apenas se o alvo NÃO for admin/owner
          (requester.role = 'owner' AND artist_members.role NOT IN ('admin', 'owner'))
        )
    )
    -- Bloquear se tentar alterar a si mesmo
    AND artist_members.user_id != auth.uid()
  )
  WITH CHECK (
    -- Na atualização, garantir que:
    EXISTS (
      SELECT 1 
      FROM artist_members requester
      WHERE requester.user_id = auth.uid()
        AND requester.artist_id = artist_members.artist_id
        AND (
          -- ADMIN pode promover para qualquer role (inclusive admin)
          requester.role = 'admin'
          OR
          -- OWNER só pode promover para editor ou viewer (não pode criar admin)
          (requester.role = 'owner' AND artist_members.role IN ('editor', 'viewer'))
        )
    )
    AND artist_members.user_id != auth.uid()
  );

-- =====================================================
-- POLÍTICA DE DELETE (Remover Colaboradores)
-- =====================================================

CREATE POLICY manage_artist_members_delete ON artist_members
  FOR DELETE
  USING (
    -- Permitir DELETE se:
    EXISTS (
      SELECT 1 
      FROM artist_members requester
      WHERE requester.user_id = auth.uid()
        AND requester.artist_id = artist_members.artist_id
        AND (
          -- ADMIN pode remover qualquer um
          requester.role = 'admin'
          OR
          -- OWNER pode remover apenas se o alvo NÃO for admin/owner
          (requester.role = 'owner' AND artist_members.role NOT IN ('admin', 'owner'))
        )
    )
    -- Bloquear se tentar remover a si mesmo
    AND artist_members.user_id != auth.uid()
  );

-- =====================================================
-- VERIFICAR POLÍTICAS CRIADAS
-- =====================================================

SELECT 
  schemaname,
  tablename,
  policyname,
  cmd,
  permissive,
  roles
FROM pg_policies
WHERE tablename = 'artist_members'
  AND policyname IN ('manage_artist_members_update', 'manage_artist_members_delete')
ORDER BY policyname, cmd;

-- =====================================================
-- TESTAR AS POLÍTICAS
-- =====================================================

-- Execute estes testes após aplicar as políticas:

-- 1. Como ADMIN, tente promover um editor para admin (DEVE FUNCIONAR)
-- 2. Como OWNER, tente promover um editor para admin (DEVE FALHAR)
-- 3. Como ADMIN, tente alterar um owner (DEVE FUNCIONAR)
-- 4. Como OWNER, tente alterar um admin (DEVE FALHAR)
-- 5. Como qualquer role, tente alterar você mesmo (DEVE FALHAR)

