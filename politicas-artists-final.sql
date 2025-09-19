-- =====================================================
-- POLÍTICAS RLS FINAIS PARA TABELA ARTISTS
-- =====================================================

-- 1. HABILITAR RLS
-- =====================================================
ALTER TABLE artists ENABLE ROW LEVEL SECURITY;

-- 2. REMOVER POLÍTICAS EXISTENTES (se houver)
-- =====================================================
DROP POLICY IF EXISTS artists_allow_insert ON artists;
DROP POLICY IF EXISTS artists_select ON artists;
DROP POLICY IF EXISTS artists_update ON artists;
DROP POLICY IF EXISTS artists_delete ON artists;

-- 3. CRIAR POLÍTICAS CORRETAS
-- =====================================================

-- INSERT: usuário autenticado pode criar artista
CREATE POLICY artists_allow_insert ON artists
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- SELECT: usuários autenticados podem ver todos os artistas
CREATE POLICY artists_select ON artists
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- UPDATE: apenas admin e owner podem atualizar
CREATE POLICY artists_update ON artists
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM artist_members
    WHERE user_id = auth.uid()
      AND artist_id = artists.id
      AND role IN ('owner','admin')
  )
);

-- DELETE: apenas owner pode deletar
CREATE POLICY artists_delete ON artists
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM artist_members
    WHERE user_id = auth.uid()
      AND artist_id = artists.id
      AND role = 'owner'
  )
);

-- 4. VERIFICAR POLÍTICAS CRIADAS
-- =====================================================
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'artists';

-- 5. VERIFICAR SE RLS ESTÁ HABILITADO
-- =====================================================
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'artists';

-- =====================================================
-- FIM DAS POLÍTICAS
-- =====================================================
