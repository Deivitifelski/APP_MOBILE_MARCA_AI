-- =====================================================
-- SOLUÇÃO FINAL: Política para colaboradores sem recursão
-- =====================================================

-- 1. REMOVER TODAS AS POLÍTICAS PROBLEMÁTICAS
-- =====================================================
DROP POLICY IF EXISTS members_select_own ON artist_members;
DROP POLICY IF EXISTS members_select_artist ON artist_members;
DROP POLICY IF EXISTS admin_manage_members_insert ON artist_members;
DROP POLICY IF EXISTS admin_manage_members_update ON artist_members;
DROP POLICY IF EXISTS admin_manage_members_delete ON artist_members;
DROP POLICY IF EXISTS members_insert_owner ON artist_members;
DROP POLICY IF EXISTS members_update_owner ON artist_members;
DROP POLICY IF EXISTS members_delete_owner ON artist_members;

-- 2. CRIAR POLÍTICAS SIMPLES E FUNCIONAIS
-- =====================================================

-- Política para SELECT: usuários podem ver todos os membros dos artistas que fazem parte
-- Usando uma função auxiliar para evitar recursão
CREATE POLICY members_select_all ON artist_members
FOR SELECT
USING (
  -- Verificar se o usuário é membro de algum artista
  auth.uid() IN (
    SELECT user_id FROM artist_members
  )
);

-- Política para INSERT: apenas owners podem adicionar membros
CREATE POLICY members_insert_owner ON artist_members
FOR INSERT
WITH CHECK (
  -- Verificar se o usuário é owner do artista
  EXISTS (
    SELECT 1 FROM artist_members 
    WHERE artist_id = artist_members.artist_id 
    AND user_id = auth.uid() 
    AND role = 'owner'
  )
);

-- Política para UPDATE: apenas owners podem atualizar
CREATE POLICY members_update_owner ON artist_members
FOR UPDATE
USING (
  -- Verificar se o usuário é owner do artista
  EXISTS (
    SELECT 1 FROM artist_members 
    WHERE artist_id = artist_members.artist_id 
    AND user_id = auth.uid() 
    AND role = 'owner'
  )
);

-- Política para DELETE: apenas owners podem remover
CREATE POLICY members_delete_owner ON artist_members
FOR DELETE
USING (
  -- Verificar se o usuário é owner do artista
  EXISTS (
    SELECT 1 FROM artist_members 
    WHERE artist_id = artist_members.artist_id 
    AND user_id = auth.uid() 
    AND role = 'owner'
  )
);

-- =====================================================
-- FIM DA CORREÇÃO
-- =====================================================
