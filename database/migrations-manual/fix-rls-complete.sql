-- =====================================================
-- SOLUÇÃO COMPLETA: Resetar RLS da tabela artist_members
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

-- 4. CRIAR POLÍTICAS SIMPLES E SEGURAS
-- =====================================================

-- Política básica: usuários podem ver seus próprios registros
CREATE POLICY members_select_own ON artist_members
FOR SELECT
USING (user_id = auth.uid());

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
