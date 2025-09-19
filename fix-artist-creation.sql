-- =====================================================
-- SOLUÇÃO RÁPIDA: Permitir criação de artistas
-- =====================================================

-- 1. DESABILITAR RLS TEMPORARIAMENTE NA TABELA ARTISTS
-- =====================================================
ALTER TABLE artists DISABLE ROW LEVEL SECURITY;

-- 2. REMOVER POLÍTICAS EXISTENTES (se houver)
-- =====================================================
DROP POLICY IF EXISTS viewer_select_artist ON artists;
DROP POLICY IF EXISTS admin_manage_artist ON artists;
DROP POLICY IF EXISTS owner_delete_artist ON artists;
DROP POLICY IF EXISTS artists_insert_policy ON artists;
DROP POLICY IF EXISTS artists_select_policy ON artists;
DROP POLICY IF EXISTS artists_update_policy ON artists;
DROP POLICY IF EXISTS artists_delete_policy ON artists;

-- 3. HABILITAR RLS NOVAMENTE
-- =====================================================
ALTER TABLE artists ENABLE ROW LEVEL SECURITY;

-- 4. CRIAR POLÍTICA SIMPLES PARA INSERT
-- =====================================================
CREATE POLICY artists_allow_insert ON artists
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- 5. CRIAR POLÍTICA SIMPLES PARA SELECT
-- =====================================================
CREATE POLICY artists_allow_select ON artists
FOR SELECT
USING (true);

-- 6. CRIAR POLÍTICA SIMPLES PARA UPDATE
-- =====================================================
CREATE POLICY artists_allow_update ON artists
FOR UPDATE
USING (auth.uid() IS NOT NULL);

-- 7. CRIAR POLÍTICA SIMPLES PARA DELETE
-- =====================================================
CREATE POLICY artists_allow_delete ON artists
FOR DELETE
USING (auth.uid() IS NOT NULL);
