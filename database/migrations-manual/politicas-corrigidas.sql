-- =====================================================
-- POLÍTICAS RLS CORRIGIDAS - Execute no Supabase SQL Editor
-- =====================================================

-- 1. REMOVER POLÍTICAS EXISTENTES (se houver)
-- =====================================================
DROP POLICY IF EXISTS viewer_select_events ON events;
DROP POLICY IF EXISTS editor_manage_events ON events;
DROP POLICY IF EXISTS editor_update_events ON events;
DROP POLICY IF EXISTS editor_delete_events ON events;
DROP POLICY IF EXISTS viewer_select_artist ON artists;
DROP POLICY IF EXISTS admin_manage_artist ON artists;
DROP POLICY IF EXISTS owner_delete_artist ON artists;
DROP POLICY IF EXISTS editor_manage_event_expenses ON event_expenses;
DROP POLICY IF EXISTS admin_manage_members ON artist_members;

-- 2. HABILITAR RLS NAS TABELAS
-- =====================================================
ALTER TABLE artists ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE artist_members ENABLE ROW LEVEL SECURITY;

-- 3. FUNÇÕES AUXILIARES
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

-- 4. POLÍTICAS PARA TABELA EVENTS
-- =====================================================

-- VIEWER/EDITOR/ADMIN/OWNER: pode visualizar eventos
CREATE POLICY viewer_select_events ON events
FOR SELECT
USING (
  user_has_access(auth.uid(), artist_id, ARRAY['viewer', 'editor', 'admin', 'owner'])
);

-- EDITOR/ADMIN/OWNER: pode criar eventos
CREATE POLICY editor_create_events ON events
FOR INSERT
USING (
  user_has_access(auth.uid(), artist_id, ARRAY['editor', 'admin', 'owner'])
);

-- EDITOR/ADMIN/OWNER: pode atualizar eventos
CREATE POLICY editor_update_events ON events
FOR UPDATE
USING (
  user_has_access(auth.uid(), artist_id, ARRAY['editor', 'admin', 'owner'])
);

-- EDITOR/ADMIN/OWNER: pode deletar eventos
CREATE POLICY editor_delete_events ON events
FOR DELETE
USING (
  user_has_access(auth.uid(), artist_id, ARRAY['editor', 'admin', 'owner'])
);

-- 5. POLÍTICAS PARA TABELA ARTISTS
-- =====================================================

-- VIEWER/EDITOR/ADMIN/OWNER: pode visualizar informações básicas
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

-- 6. POLÍTICAS PARA TABELA EVENT_EXPENSES
-- =====================================================

-- EDITOR/ADMIN/OWNER: pode visualizar e gerenciar despesas
CREATE POLICY editor_manage_event_expenses ON event_expenses
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM events e
    JOIN artist_members am ON am.artist_id = e.artist_id
    WHERE e.id = event_expenses.event_id
      AND am.user_id = auth.uid()
      AND am.role IN ('editor', 'admin', 'owner')
  )
);

-- 7. POLÍTICAS PARA TABELA ARTIST_MEMBERS
-- =====================================================

-- ADMIN/OWNER: pode gerenciar membros
CREATE POLICY admin_manage_members ON artist_members
FOR ALL
USING (
  user_has_access(auth.uid(), artist_id, ARRAY['admin', 'owner'])
);

-- 8. FUNÇÃO PARA FILTRAR EVENTOS POR ROLE
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

-- 9. ÍNDICES PARA PERFORMANCE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_artist_members_user_artist ON artist_members(user_id, artist_id);
CREATE INDEX IF NOT EXISTS idx_artist_members_role ON artist_members(role);
CREATE INDEX IF NOT EXISTS idx_events_artist_id ON events(artist_id);
CREATE INDEX IF NOT EXISTS idx_event_expenses_event_id ON event_expenses(event_id);

-- =====================================================
-- FIM DAS POLÍTICAS CORRIGIDAS
-- =====================================================
