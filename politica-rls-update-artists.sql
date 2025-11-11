-- ============================================
-- POLÍTICA RLS PARA UPDATE NA TABELA ARTISTS
-- Apenas OWNER e ADMIN podem atualizar artistas
-- ============================================

-- Primeiro, remover política existente se houver
DROP POLICY IF EXISTS "Apenas owner e admin podem atualizar artistas" ON artists;

-- Criar nova política para UPDATE
CREATE POLICY "Apenas owner e admin podem atualizar artistas"
ON artists
FOR UPDATE
USING (
  -- Verificar se o usuário é owner ou admin do artista
  EXISTS (
    SELECT 1
    FROM artist_members
    WHERE artist_members.artist_id = artists.id
    AND artist_members.user_id = auth.uid()
    AND artist_members.role IN ('owner', 'admin')
  )
)
WITH CHECK (
  -- Mesma verificação para os dados após o update
  EXISTS (
    SELECT 1
    FROM artist_members
    WHERE artist_members.artist_id = artists.id
    AND artist_members.user_id = auth.uid()
    AND artist_members.role IN ('owner', 'admin')
  )
);

-- ============================================
-- POLÍTICA RLS PARA SELECT NA TABELA ARTISTS
-- Permitir que o select funcione após update
-- ============================================

-- Remover política de SELECT se existir
DROP POLICY IF EXISTS "Usuários podem ver seus artistas" ON artists;

-- Criar política para SELECT
CREATE POLICY "Usuários podem ver seus artistas"
ON artists
FOR SELECT
USING (
  -- Permitir se o usuário é membro do artista
  EXISTS (
    SELECT 1
    FROM artist_members
    WHERE artist_members.artist_id = artists.id
    AND artist_members.user_id = auth.uid()
  )
);

-- ============================================
-- VERIFICAR POLÍTICAS ATIVAS
-- ============================================

SELECT 
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'artists'
ORDER BY policyname;

