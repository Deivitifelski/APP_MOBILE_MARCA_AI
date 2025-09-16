-- =====================================================
-- SISTEMA DE PERMISSÕES BASEADO EM ROLES
-- =====================================================

-- 1. HABILITAR RLS NAS TABELAS SENSÍVEIS
-- =====================================================
ALTER TABLE artists ENABLE ROW LEVEL SECURITY;
ALTER TABLE finances ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE artist_members ENABLE ROW LEVEL SECURITY;

-- 2. FUNÇÃO AUXILIAR PARA VERIFICAR ROLE DO USUÁRIO
-- =====================================================
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

-- 3. FUNÇÃO AUXILIAR PARA VERIFICAR SE USUÁRIO TEM ACESSO
-- =====================================================
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

-- 4. POLÍTICAS PARA TABELA EVENTS
-- =====================================================

-- VIEWER: pode apenas listar eventos públicos (sem valores, sem finanças)
CREATE POLICY viewer_select_events ON events
FOR SELECT
USING (
  user_has_access(auth.uid(), artist_id, ARRAY['viewer', 'editor', 'admin', 'owner'])
);

-- EDITOR/ADMIN/OWNER: pode criar e editar eventos
CREATE POLICY editor_manage_events ON events
FOR ALL
USING (
  user_has_access(auth.uid(), artist_id, ARRAY['editor', 'admin', 'owner'])
);

-- 5. POLÍTICAS PARA TABELA ARTISTS
-- =====================================================

-- VIEWER/EDITOR: pode apenas visualizar informações básicas
CREATE POLICY viewer_select_artist ON artists
FOR SELECT
USING (
  user_has_access(auth.uid(), id, ARRAY['viewer', 'editor', 'admin', 'owner'])
);

-- ADMIN/OWNER: pode atualizar informações do artista
CREATE POLICY admin_manage_artist ON artists
FOR UPDATE
USING (
  user_has_access(auth.uid(), id, ARRAY['admin', 'owner'])
);

-- OWNER: pode deletar o artista
CREATE POLICY owner_delete_artist ON artists
FOR DELETE
USING (
  user_has_access(auth.uid(), id, ARRAY['owner'])
);

-- 6. POLÍTICAS PARA TABELA FINANCES
-- =====================================================

-- EDITOR/ADMIN/OWNER: pode visualizar e gerenciar finanças
CREATE POLICY editor_manage_finances ON finances
FOR ALL
USING (
  user_has_access(auth.uid(), artist_id, ARRAY['editor', 'admin', 'owner'])
);

-- 7. POLÍTICAS PARA TABELA ARTIST_MEMBERS
-- =====================================================

-- ADMIN/OWNER: pode gerenciar membros
CREATE POLICY admin_manage_members ON artist_members
FOR ALL
USING (
  user_has_access(auth.uid(), artist_id, ARRAY['admin', 'owner'])
);

-- 8. VIEWS FILTRADAS POR ROLE
-- =====================================================

-- View para eventos públicos (VIEWER)
CREATE OR REPLACE VIEW public_events AS
SELECT 
  id,
  artist_id,
  name,
  description,
  event_date,
  start_time,
  end_time,
  city,
  contractor_phone,
  confirmed,
  created_at,
  updated_at
FROM events
WHERE user_has_access(auth.uid(), artist_id, ARRAY['viewer', 'editor', 'admin', 'owner']);

-- View para eventos completos (EDITOR/ADMIN/OWNER)
CREATE OR REPLACE VIEW full_events AS
SELECT 
  id,
  artist_id,
  created_by,
  name,
  description,
  event_date,
  start_time,
  end_time,
  value,
  city,
  contractor_phone,
  confirmed,
  created_at,
  updated_at
FROM events
WHERE user_has_access(auth.uid(), artist_id, ARRAY['editor', 'admin', 'owner']);

-- 9. FUNÇÃO PARA OBTER DADOS FILTRADOS POR ROLE
-- =====================================================
CREATE OR REPLACE FUNCTION get_events_by_role(p_artist_id UUID)
RETURNS TABLE (
  id UUID,
  artist_id UUID,
  created_by UUID,
  name TEXT,
  description TEXT,
  event_date DATE,
  start_time TIME,
  end_time TIME,
  value NUMERIC,
  city TEXT,
  contractor_phone TEXT,
  confirmed BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
  user_role TEXT;
BEGIN
  -- Obter role do usuário
  user_role := get_user_role(auth.uid(), p_artist_id);
  
  -- Retornar dados baseados no role
  IF user_role = 'viewer' THEN
    RETURN QUERY
    SELECT 
      e.id,
      e.artist_id,
      e.created_by,
      e.name,
      e.description,
      e.event_date,
      e.start_time,
      e.end_time,
      NULL::NUMERIC as value, -- Ocultar valor para viewer
      e.city,
      e.contractor_phone,
      e.confirmed,
      e.created_at,
      e.updated_at
    FROM events e
    WHERE e.artist_id = p_artist_id;
  ELSE
    RETURN QUERY
    SELECT 
      e.id,
      e.artist_id,
      e.created_by,
      e.name,
      e.description,
      e.event_date,
      e.start_time,
      e.end_time,
      e.value,
      e.city,
      e.contractor_phone,
      e.confirmed,
      e.created_at,
      e.updated_at
    FROM events e
    WHERE e.artist_id = p_artist_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. ÍNDICES PARA PERFORMANCE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_artist_members_user_artist ON artist_members(user_id, artist_id);
CREATE INDEX IF NOT EXISTS idx_artist_members_role ON artist_members(role);
CREATE INDEX IF NOT EXISTS idx_events_artist_id ON events(artist_id);
CREATE INDEX IF NOT EXISTS idx_finances_artist_id ON finances(artist_id);

-- 11. COMENTÁRIOS PARA DOCUMENTAÇÃO
-- =====================================================
COMMENT ON FUNCTION get_user_role(UUID, UUID) IS 'Retorna o role do usuário para um artista específico';
COMMENT ON FUNCTION user_has_access(UUID, UUID, TEXT[]) IS 'Verifica se o usuário tem acesso com um dos roles especificados';
COMMENT ON FUNCTION get_events_by_role(UUID) IS 'Retorna eventos filtrados baseado no role do usuário';
COMMENT ON VIEW public_events IS 'View para eventos públicos (sem valores financeiros)';
COMMENT ON VIEW full_events IS 'View para eventos completos (com valores financeiros)';
