-- =====================================================
-- VERIFICAR E GARANTIR QUE ADMIN POSSA CRIAR EVENTOS
-- Execute no SQL Editor do Supabase
-- =====================================================

-- 1️⃣ Verificar políticas atuais da tabela EVENTS
-- =====================================================

SELECT 
  policyname as "Política",
  cmd as "Comando",
  qual as "Condição"
FROM pg_policies
WHERE tablename = 'events'
ORDER BY policyname;

-- =====================================================
-- 2️⃣ ATUALIZAR/CRIAR POLÍTICAS PARA EVENTS
-- Garantindo que ADMIN tenha todas as permissões
-- =====================================================

-- Remover políticas antigas
DROP POLICY IF EXISTS editor_create_events ON events;
DROP POLICY IF EXISTS editor_update_events ON events;
DROP POLICY IF EXISTS editor_delete_events ON events;
DROP POLICY IF EXISTS viewer_select_events ON events;

-- VIEWER/EDITOR/ADMIN: pode visualizar eventos
CREATE POLICY viewer_select_events ON events
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM artist_members am
    WHERE am.user_id = auth.uid()
      AND am.artist_id = events.artist_id
      AND am.role IN ('viewer', 'editor', 'admin')
  )
);

-- EDITOR/ADMIN: pode criar eventos
CREATE POLICY editor_create_events ON events
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM artist_members am
    WHERE am.user_id = auth.uid()
      AND am.artist_id = events.artist_id
      AND am.role IN ('editor', 'admin')
  )
);

-- EDITOR/ADMIN: pode atualizar eventos
CREATE POLICY editor_update_events ON events
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM artist_members am
    WHERE am.user_id = auth.uid()
      AND am.artist_id = events.artist_id
      AND am.role IN ('editor', 'admin')
  )
);

-- EDITOR/ADMIN: pode deletar eventos
CREATE POLICY editor_delete_events ON events
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM artist_members am
    WHERE am.user_id = auth.uid()
      AND am.artist_id = events.artist_id
      AND am.role IN ('editor', 'admin')
  )
);

-- =====================================================
-- 3️⃣ VERIFICAR POLÍTICAS CRIADAS
-- =====================================================

SELECT 
  policyname as "Política",
  cmd as "Comando (Operação)",
  CASE 
    WHEN cmd = 'SELECT' THEN 'Visualizar'
    WHEN cmd = 'INSERT' THEN 'Criar'
    WHEN cmd = 'UPDATE' THEN 'Atualizar'
    WHEN cmd = 'DELETE' THEN 'Deletar'
    ELSE cmd
  END as "Ação",
  CASE
    WHEN qual::text LIKE '%viewer%' AND qual::text LIKE '%editor%' AND qual::text LIKE '%admin%' 
      THEN 'viewer, editor, admin'
    WHEN qual::text LIKE '%editor%' AND qual::text LIKE '%admin%' 
      THEN 'editor, admin'
    ELSE 'Ver condição completa abaixo'
  END as "Roles Permitidas"
FROM pg_policies
WHERE tablename = 'events'
ORDER BY 
  CASE cmd
    WHEN 'SELECT' THEN 1
    WHEN 'INSERT' THEN 2
    WHEN 'UPDATE' THEN 3
    WHEN 'DELETE' THEN 4
  END;

-- =====================================================
-- RESUMO DAS PERMISSÕES DE EVENTOS PARA ADMIN
-- =====================================================
-- 
-- ✅ SELECT (Visualizar): viewer, editor, admin
-- ✅ INSERT (Criar): editor, admin
-- ✅ UPDATE (Atualizar): editor, admin
-- ✅ DELETE (Deletar): editor, admin
-- 
-- ⚠️ NOTA: Removemos 'owner' porque agora só temos 'admin'
-- O criador do artista é sempre 'admin'
-- =====================================================

