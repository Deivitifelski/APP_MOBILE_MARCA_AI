-- =====================================================
-- POLÍTICAS FINAIS: ARTIST_MEMBERS
-- ADMIN pode alterar TODOS
-- OWNER não pode alterar ADMIN
-- =====================================================

-- 1. Ver políticas atuais
SELECT 
  policyname,
  cmd,
  permissive
FROM pg_policies
WHERE tablename = 'artist_members'
ORDER BY cmd, policyname;

-- 2. Deletar TODAS as políticas antigas
DROP POLICY IF EXISTS members_select_all ON artist_members;
DROP POLICY IF EXISTS members_select_own ON artist_members;
DROP POLICY IF EXISTS select_artist_members ON artist_members;
DROP POLICY IF EXISTS members_can_view_all_in_artist ON artist_members;
DROP POLICY IF EXISTS "Membros podem ver todos do artista" ON artist_members;
DROP POLICY IF EXISTS admin_manage_members_update ON artist_members;
DROP POLICY IF EXISTS admin_manage_members_delete ON artist_members;
DROP POLICY IF EXISTS admin_manage_members_insert ON artist_members;
DROP POLICY IF EXISTS "Admin e Owner podem adicionar membros" ON artist_members;
DROP POLICY IF EXISTS "Admin e Owner podem atualizar membros" ON artist_members;
DROP POLICY IF EXISTS "Admin e Owner podem remover membros" ON artist_members;
DROP POLICY IF EXISTS admin_owner_update_members ON artist_members;
DROP POLICY IF EXISTS owner_update_members ON artist_members;
DROP POLICY IF EXISTS members_update_policy ON artist_members;
DROP POLICY IF EXISTS members_delete_policy ON artist_members;
DROP POLICY IF EXISTS members_insert_policy ON artist_members;

-- 3. SELECT: Ver todos os membros dos artistas que você participa
CREATE POLICY "SELECT: Ver membros do artista" ON artist_members
FOR SELECT
USING (
  artist_id IN (
    SELECT artist_id 
    FROM artist_members 
    WHERE user_id = auth.uid()
  )
);

-- 4. INSERT: Apenas ADMIN e OWNER podem adicionar membros
CREATE POLICY "INSERT: Admin e Owner adicionam" ON artist_members
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM artist_members 
    WHERE artist_id = artist_members.artist_id
      AND user_id = auth.uid()
      AND role IN ('admin', 'owner')
  )
);

-- 5. UPDATE: ADMIN pode alterar TODOS | OWNER não pode alterar ADMIN
CREATE POLICY "UPDATE: Admin altera todos, Owner não altera Admin" ON artist_members
FOR UPDATE
USING (
  -- Deve ser admin ou owner do artista
  EXISTS (
    SELECT 1 
    FROM artist_members my_role
    WHERE my_role.artist_id = artist_members.artist_id
      AND my_role.user_id = auth.uid()
      AND my_role.role IN ('admin', 'owner')
  )
  AND
  -- Se você é ADMIN, pode alterar qualquer um
  (
    EXISTS (
      SELECT 1 
      FROM artist_members my_role
      WHERE my_role.artist_id = artist_members.artist_id
        AND my_role.user_id = auth.uid()
        AND my_role.role = 'admin'
    )
    OR
    -- Se você é OWNER, pode alterar desde que o alvo NÃO seja admin
    (
      EXISTS (
        SELECT 1 
        FROM artist_members my_role
        WHERE my_role.artist_id = artist_members.artist_id
          AND my_role.user_id = auth.uid()
          AND my_role.role = 'owner'
      )
      AND artist_members.role != 'admin'
    )
  )
)
WITH CHECK (
  -- Mesma validação para WITH CHECK
  EXISTS (
    SELECT 1 
    FROM artist_members my_role
    WHERE my_role.artist_id = artist_members.artist_id
      AND my_role.user_id = auth.uid()
      AND my_role.role IN ('admin', 'owner')
  )
);

-- 6. DELETE: ADMIN pode remover TODOS | OWNER não pode remover ADMIN
CREATE POLICY "DELETE: Admin remove todos, Owner não remove Admin" ON artist_members
FOR DELETE
USING (
  -- Deve ser admin ou owner do artista
  EXISTS (
    SELECT 1 
    FROM artist_members my_role
    WHERE my_role.artist_id = artist_members.artist_id
      AND my_role.user_id = auth.uid()
      AND my_role.role IN ('admin', 'owner')
  )
  AND
  -- Se você é ADMIN, pode remover qualquer um
  (
    EXISTS (
      SELECT 1 
      FROM artist_members my_role
      WHERE my_role.artist_id = artist_members.artist_id
        AND my_role.user_id = auth.uid()
        AND my_role.role = 'admin'
    )
    OR
    -- Se você é OWNER, pode remover desde que o alvo NÃO seja admin
    (
      EXISTS (
        SELECT 1 
        FROM artist_members my_role
        WHERE my_role.artist_id = artist_members.artist_id
          AND my_role.user_id = auth.uid()
          AND my_role.role = 'owner'
      )
      AND artist_members.role != 'admin'
    )
  )
);

-- 7. Verificar as políticas criadas
SELECT 
  policyname,
  cmd,
  CASE cmd
    WHEN 'SELECT' THEN '✅ Ver todos do artista'
    WHEN 'INSERT' THEN '✅ Admin e Owner podem adicionar'
    WHEN 'UPDATE' THEN '✅ ADMIN altera todos | OWNER não altera Admin'
    WHEN 'DELETE' THEN '✅ ADMIN remove todos | OWNER não remove Admin'
  END as descricao
FROM pg_policies
WHERE tablename = 'artist_members'
ORDER BY cmd, policyname;

-- 8. Testar se você consegue ver os membros
SELECT 
  u.name,
  u.email,
  am.role,
  a.name as artista,
  CASE 
    WHEN am.user_id = auth.uid() THEN '✅ Você'
    ELSE '👥 Outro'
  END as status
FROM artist_members am
JOIN users u ON u.id = am.user_id
JOIN artists a ON a.id = am.artist_id
WHERE am.artist_id IN (
  SELECT artist_id 
  FROM artist_members 
  WHERE user_id = auth.uid()
)
ORDER BY 
  CASE am.role
    WHEN 'admin' THEN 1
    WHEN 'owner' THEN 2
    WHEN 'editor' THEN 3
    WHEN 'viewer' THEN 4
  END,
  u.name;

-- 9. Resumo das Regras
SELECT 
  'HIERARQUIA DE PERMISSÕES' as titulo,
  '🛡️ ADMIN: Pode alterar/remover TODOS (incluindo owner)' as admin,
  '👑 OWNER: Pode alterar/remover todos EXCETO admin' as owner,
  '✏️ EDITOR: Não pode gerenciar colaboradores' as editor,
  '👁️ VIEWER: Não pode gerenciar colaboradores' as viewer;

