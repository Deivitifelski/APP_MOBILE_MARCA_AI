-- =====================================================
-- CORREÇÃO: Política RLS para INSERT na tabela artists
-- =====================================================

-- 1. REMOVER POLÍTICAS EXISTENTES DA TABELA ARTISTS (se houver)
-- =====================================================
DROP POLICY IF EXISTS viewer_select_artist ON artists;
DROP POLICY IF EXISTS admin_manage_artist ON artists;
DROP POLICY IF EXISTS owner_delete_artist ON artists;
DROP POLICY IF EXISTS artists_insert_policy ON artists;

-- 2. CRIAR POLÍTICAS CORRETAS PARA TABELA ARTISTS
-- =====================================================

-- Política para SELECT: usuários podem ver artistas que são membros
CREATE POLICY artists_select_policy ON artists
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM artist_members 
    WHERE artist_id = artists.id 
    AND user_id = auth.uid()
  )
);

-- Política para INSERT: qualquer usuário autenticado pode criar um artista
CREATE POLICY artists_insert_policy ON artists
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Política para UPDATE: apenas owners podem atualizar informações do artista
CREATE POLICY artists_update_policy ON artists
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM artist_members 
    WHERE artist_id = artists.id 
    AND user_id = auth.uid() 
    AND role = 'owner'
  )
);

-- Política para DELETE: apenas owners podem deletar o artista
CREATE POLICY artists_delete_policy ON artists
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM artist_members 
    WHERE artist_id = artists.id 
    AND user_id = auth.uid() 
    AND role = 'owner'
  )
);

-- 3. VERIFICAR SE RLS ESTÁ HABILITADO
-- =====================================================
ALTER TABLE artists ENABLE ROW LEVEL SECURITY;

-- 4. VERIFICAR SE AS FUNÇÕES AUXILIARES EXISTEM
-- =====================================================

-- Função para verificar role do usuário
CREATE OR REPLACE FUNCTION get_user_role(p_user_id UUID, p_artist_id UUID)
RETURNS TEXT AS $$
BEGIN
  RETURN (
    SELECT role 
    FROM artist_members 
    WHERE user_id = p_user_id 
      AND artist_id = p_artist_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para verificar se usuário tem acesso
CREATE OR REPLACE FUNCTION user_has_access(p_user_id UUID, p_artist_id UUID, p_required_roles TEXT[])
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM artist_members 
    WHERE user_id = p_user_id 
      AND artist_id = p_artist_id
      AND role = ANY(p_required_roles)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
