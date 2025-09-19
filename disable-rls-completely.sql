-- =====================================================
-- SOLUÇÃO RADICAL: Desabilitar RLS completamente
-- =====================================================

-- 1. DESABILITAR RLS EM TODAS AS TABELAS
-- =====================================================
ALTER TABLE artists DISABLE ROW LEVEL SECURITY;
ALTER TABLE artist_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE events DISABLE ROW LEVEL SECURITY;
ALTER TABLE event_expenses DISABLE ROW LEVEL SECURITY;
ALTER TABLE finances DISABLE ROW LEVEL SECURITY;

-- 2. REMOVER TODAS AS POLÍTICAS EXISTENTES
-- =====================================================

-- Remover políticas da tabela artists
DROP POLICY IF EXISTS admin_manage_artist ON artists;
DROP POLICY IF EXISTS owner_delete_artist ON artists;
DROP POLICY IF EXISTS viewer_select_artist ON artists;
DROP POLICY IF EXISTS artists_allow_insert_owner ON artists;
DROP POLICY IF EXISTS artists_select ON artists;
DROP POLICY IF EXISTS artists_update ON artists;
DROP POLICY IF EXISTS artists_delete ON artists;
DROP POLICY IF EXISTS artists_allow_insert ON artists;

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
DROP POLICY IF EXISTS members_select_policy ON artist_members;
DROP POLICY IF EXISTS members_insert_policy ON artist_members;
DROP POLICY IF EXISTS members_update_policy ON artist_members;
DROP POLICY IF EXISTS members_delete_policy ON artist_members;

-- Remover políticas da tabela events
DROP POLICY IF EXISTS viewer_select_events ON events;
DROP POLICY IF EXISTS editor_manage_events ON events;
DROP POLICY IF EXISTS editor_update_events ON events;
DROP POLICY IF EXISTS editor_delete_events ON events;
DROP POLICY IF EXISTS events_select_policy ON events;
DROP POLICY IF EXISTS events_insert_policy ON events;
DROP POLICY IF EXISTS events_update_policy ON events;
DROP POLICY IF EXISTS events_delete_policy ON events;

-- 3. REMOVER FUNÇÕES AUXILIARES
-- =====================================================
DROP FUNCTION IF EXISTS can_create_artist(uuid);
DROP FUNCTION IF EXISTS can_view_artist(uuid, uuid);
DROP FUNCTION IF EXISTS get_user_role(uuid, uuid);
DROP FUNCTION IF EXISTS user_has_access(uuid, uuid, text[]);

-- 4. VERIFICAR ESTADO FINAL
-- =====================================================

-- Verificar se RLS está desabilitado
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN ('artists', 'artist_members', 'events', 'event_expenses', 'finances');

-- Verificar se não há políticas restantes
SELECT schemaname, tablename, policyname
FROM pg_policies 
WHERE tablename IN ('artists', 'artist_members', 'events', 'event_expenses', 'finances');

-- =====================================================
-- FIM - RLS COMPLETAMENTE DESABILITADO
-- =====================================================
