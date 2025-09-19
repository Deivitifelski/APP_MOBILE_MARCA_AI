-- =====================================================
-- CORREÇÃO COMPLETA: Todas as políticas RLS necessárias
-- =====================================================

-- 1. REMOVER TODAS AS POLÍTICAS EXISTENTES
-- =====================================================

-- Remover políticas da tabela artists
DROP POLICY IF EXISTS viewer_select_artist ON artists;
DROP POLICY IF EXISTS admin_manage_artist ON artists;
DROP POLICY IF EXISTS owner_delete_artist ON artists;
DROP POLICY IF EXISTS artists_insert_policy ON artists;
DROP POLICY IF EXISTS artists_select_policy ON artists;
DROP POLICY IF EXISTS artists_update_policy ON artists;
DROP POLICY IF EXISTS artists_delete_policy ON artists;

-- Remover políticas da tabela artist_members
DROP POLICY IF EXISTS members_select_own ON artist_members;
DROP POLICY IF EXISTS members_select_artist ON artist_members;
DROP POLICY IF EXISTS members_select_all ON artist_members;
DROP POLICY IF EXISTS admin_manage_members_insert ON artist_members;
DROP POLICY IF EXISTS admin_manage_members_update ON artist_members;
DROP POLICY IF EXISTS admin_manage_members_delete ON artist_members;
DROP POLICY IF EXISTS members_insert_owner ON artist_members;
DROP POLICY IF EXISTS members_update_owner ON artist_members;
DROP POLICY IF EXISTS members_delete_owner ON artist_members;

-- Remover políticas da tabela events
DROP POLICY IF EXISTS viewer_select_events ON events;
DROP POLICY IF EXISTS editor_manage_events ON events;
DROP POLICY IF EXISTS editor_update_events ON events;
DROP POLICY IF EXISTS editor_delete_events ON events;

-- 2. HABILITAR RLS NAS TABELAS
-- =====================================================
ALTER TABLE artists ENABLE ROW LEVEL SECURITY;
ALTER TABLE artist_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- 3. CRIAR FUNÇÕES AUXILIARES
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

-- 4. POLÍTICAS PARA TABELA ARTISTS
-- =====================================================

-- SELECT: usuários podem ver artistas que são membros
CREATE POLICY artists_select_policy ON artists
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM artist_members 
    WHERE artist_id = artists.id 
    AND user_id = auth.uid()
  )
);

-- INSERT: qualquer usuário autenticado pode criar um artista
CREATE POLICY artists_insert_policy ON artists
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- UPDATE: apenas owners podem atualizar informações do artista
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

-- DELETE: apenas owners podem deletar o artista
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

-- 5. POLÍTICAS PARA TABELA ARTIST_MEMBERS
-- =====================================================

-- SELECT: usuários podem ver seus próprios registros e de artistas que gerenciam
CREATE POLICY members_select_policy ON artist_members
FOR SELECT
USING (
  user_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM artist_members am2
    WHERE am2.artist_id = artist_members.artist_id
    AND am2.user_id = auth.uid()
    AND am2.role IN ('owner', 'admin')
  )
);

-- INSERT: apenas owners podem adicionar membros
CREATE POLICY members_insert_policy ON artist_members
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM artist_members 
    WHERE artist_id = artist_members.artist_id 
    AND user_id = auth.uid() 
    AND role = 'owner'
  )
);

-- UPDATE: apenas owners podem atualizar roles
CREATE POLICY members_update_policy ON artist_members
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM artist_members 
    WHERE artist_id = artist_members.artist_id 
    AND user_id = auth.uid() 
    AND role = 'owner'
  )
);

-- DELETE: apenas owners podem remover membros
CREATE POLICY members_delete_policy ON artist_members
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM artist_members 
    WHERE artist_id = artist_members.artist_id 
    AND user_id = auth.uid() 
    AND role = 'owner'
  )
);

-- 6. POLÍTICAS PARA TABELA EVENTS
-- =====================================================

-- SELECT: usuários podem ver eventos de artistas que são membros
CREATE POLICY events_select_policy ON events
FOR SELECT
USING (
  user_has_access(auth.uid(), artist_id, ARRAY['viewer', 'editor', 'admin', 'owner'])
);

-- INSERT: apenas editors, admins e owners podem criar eventos
CREATE POLICY events_insert_policy ON events
FOR INSERT
WITH CHECK (
  user_has_access(auth.uid(), artist_id, ARRAY['editor', 'admin', 'owner'])
);

-- UPDATE: apenas editors, admins e owners podem atualizar eventos
CREATE POLICY events_update_policy ON events
FOR UPDATE
USING (
  user_has_access(auth.uid(), artist_id, ARRAY['editor', 'admin', 'owner'])
);

-- DELETE: apenas admins e owners podem deletar eventos
CREATE POLICY events_delete_policy ON events
FOR DELETE
USING (
  user_has_access(auth.uid(), artist_id, ARRAY['admin', 'owner'])
);
