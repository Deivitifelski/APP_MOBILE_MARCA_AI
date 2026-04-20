-- =====================================================
-- VIEW PARA RETORNAR EVENTOS BASEADO NA ROLE
-- Oculta coluna 'value' para viewers
-- =====================================================

-- 1️⃣ Criar função auxiliar para obter role do usuário
CREATE OR REPLACE FUNCTION get_user_role_for_artist(p_artist_id UUID)
RETURNS TEXT AS $$
BEGIN
  RETURN (
    SELECT role 
    FROM artist_members 
    WHERE user_id = auth.uid() 
      AND artist_id = p_artist_id
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 2️⃣ Criar VIEW que filtra colunas baseado na role
-- =====================================================

CREATE OR REPLACE VIEW events_with_role_permissions AS
SELECT 
  e.id,
  e.artist_id,
  e.created_by,
  e.name,
  e.description,
  e.event_date,
  e.start_time,
  e.end_time,
  e.city,
  e.contractor_phone,
  e.confirmed,
  e.tag,
  e.created_at,
  e.updated_at,
  -- ✅ VALUE: Ocultar para VIEWER, mostrar para EDITOR/ADMIN/OWNER
  CASE 
    WHEN get_user_role_for_artist(e.artist_id) IN ('editor', 'admin', 'owner') 
    THEN e.value
    ELSE NULL  -- Viewer não vê o valor
  END AS value,
  -- Incluir a role do usuário para facilitar na aplicação
  get_user_role_for_artist(e.artist_id) AS user_role
FROM events e
WHERE EXISTS (
  SELECT 1 
  FROM artist_members am
  WHERE am.user_id = auth.uid()
    AND am.artist_id = e.artist_id
    AND am.role IN ('viewer', 'editor', 'admin', 'owner')
);

-- =====================================================
-- 3️⃣ Habilitar RLS na VIEW
-- =====================================================

ALTER VIEW events_with_role_permissions SET (security_barrier = true);

-- =====================================================
-- 4️⃣ Testar a VIEW
-- =====================================================

-- Buscar eventos (automaticamente filtra baseado na role)
SELECT * FROM events_with_role_permissions 
WHERE artist_id = 'SEU_ARTIST_ID_AQUI';

-- =====================================================
-- COMO USAR NO CÓDIGO TYPESCRIPT
-- =====================================================

/*
// ANTES (buscar da tabela events diretamente)
const { data } = await supabase
  .from('events')
  .select('*')
  .eq('artist_id', artistId);

// DEPOIS (buscar da VIEW que já filtra)
const { data } = await supabase
  .from('events_with_role_permissions')
  .select('*')
  .eq('artist_id', artistId);

// A VIEW automaticamente:
// - Se VIEWER: value será NULL
// - Se EDITOR/ADMIN/OWNER: value terá o valor real
// - Já inclui o user_role na resposta
*/

-- =====================================================
-- VANTAGENS DESTA ABORDAGEM
-- =====================================================
-- 
-- ✅ Segurança no banco de dados (não depende do código)
-- ✅ Centralizado (uma única fonte da verdade)
-- ✅ Performance (executa no banco, não na aplicação)
-- ✅ Fácil de manter e atualizar
-- ✅ Funciona com RLS automaticamente
-- 
-- =====================================================

