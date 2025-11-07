-- ================================================================
-- POLÍTICA RLS: Permitir que usuários saiam do artista
-- ================================================================

-- Esta política permite que qualquer usuário autenticado
-- remova a si mesmo (sair do artista)

-- Remover política antiga se existir
DROP POLICY IF EXISTS "Users can remove themselves from artist" ON artist_members;

-- Criar nova política: usuário pode remover a si mesmo
CREATE POLICY "Users can remove themselves from artist"
ON artist_members
FOR DELETE
TO authenticated
USING (
  auth.uid() = user_id
);

-- Verificar políticas de DELETE em artist_members
SELECT 
    policyname,
    cmd,
    qual as using_clause,
    with_check as with_check_clause
FROM pg_policies 
WHERE tablename = 'artist_members' 
  AND cmd = 'DELETE'
ORDER BY policyname;

-- ================================================================
-- FIM
-- ================================================================

