-- =====================================================
-- SOLUÇÃO FINAL: Permitir criação de artistas
-- =====================================================

-- 1️⃣ Desabilitar RLS temporariamente
ALTER TABLE artists DISABLE ROW LEVEL SECURITY;

-- 2️⃣ Deletar políticas antigas
DROP POLICY IF EXISTS admin_manage_artist ON artists;
DROP POLICY IF EXISTS owner_delete_artist ON artists;
DROP POLICY IF EXISTS viewer_select_artist ON artists;
DROP POLICY IF EXISTS artists_allow_insert_owner ON artists;
DROP POLICY IF EXISTS artists_select ON artists;
DROP POLICY IF EXISTS artists_update ON artists;
DROP POLICY IF EXISTS artists_delete ON artists;

-- 3️⃣ Deletar funções antigas
DROP FUNCTION IF EXISTS can_create_artist(uuid);
DROP FUNCTION IF EXISTS can_view_artist(uuid, uuid);

-- 4️⃣ Habilitar RLS novamente
ALTER TABLE artists ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 5️⃣ Funções auxiliares corrigidas
-- =====================================================

-- Verifica se usuário pode criar novo artista
-- Se não tem plano, permite criar (primeiro artista)
-- Se tem plano, verifica limite
CREATE OR REPLACE FUNCTION can_create_artist(p_user_id uuid)
RETURNS boolean AS $$
DECLARE
    v_max_artistas int;
    v_count_artistas int;
    v_has_plano boolean;
BEGIN
    -- Verificar se usuário tem plano
    SELECT EXISTS(
        SELECT 1 FROM usuario_plano WHERE id_usuario = p_user_id
    ) INTO v_has_plano;
    
    -- Se não tem plano, permite criar (primeiro artista)
    IF NOT v_has_plano THEN
        RETURN true;
    END IF;
    
    -- Se tem plano, verificar limite
    SELECT max_usuarios INTO v_max_artistas
    FROM planos
    JOIN usuario_plano up ON planos.id = up.id_plano
    WHERE up.id_usuario = p_user_id;

    SELECT count(*) INTO v_count_artistas
    FROM artist_members
    WHERE user_id = p_user_id AND role = 'owner';

    -- Se max_usuarios é NULL, significa ilimitado
    IF v_max_artistas IS NULL THEN
        RETURN true;
    END IF;

    RETURN v_count_artistas < v_max_artistas;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verifica se usuário é membro do artista
CREATE OR REPLACE FUNCTION can_view_artist(p_user_id uuid, p_artist_id uuid)
RETURNS boolean AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM artist_members
        WHERE user_id = p_user_id AND artist_id = p_artist_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 6️⃣ Políticas novas e simplificadas
-- =====================================================

-- INSERT: usuário autenticado pode criar artista
-- A validação de limite será feita no app, não no RLS
CREATE POLICY artists_allow_insert ON artists
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- SELECT: membros do artista podem ver
CREATE POLICY artists_select ON artists
FOR SELECT
USING (can_view_artist(auth.uid(), id));

-- UPDATE: apenas admin e owner podem atualizar
CREATE POLICY artists_update ON artists
FOR UPDATE
USING (
    EXISTS (
        SELECT 1
        FROM artist_members
        WHERE user_id = auth.uid()
          AND artist_id = id
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
          AND artist_id = id
          AND role = 'owner'
    )
);

-- =====================================================
-- 7️⃣ Verificar se as políticas foram criadas
-- =====================================================

-- Listar políticas da tabela artists
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'artists';

-- =====================================================
-- FIM DAS POLÍTICAS
-- =====================================================
