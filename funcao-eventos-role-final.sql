-- =====================================================
-- FUNÇÃO FINAL CORRIGIDA - SEM user_id
-- A tabela events só tem created_by, não user_id
-- =====================================================

-- 1️⃣ REMOVER FUNÇÕES ANTIGAS
DROP FUNCTION IF EXISTS get_events_by_role(uuid);
DROP FUNCTION IF EXISTS get_event_by_id_with_role(uuid);
DROP FUNCTION IF EXISTS get_user_role_for_artist(uuid);

-- =====================================================
-- 2️⃣ Função auxiliar para obter role do usuário
-- =====================================================

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
-- 3️⃣ FUNÇÃO PRINCIPAL - SEM user_id
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
  value NUMERIC,  -- NULL para viewer
  city TEXT,
  contractor_phone TEXT,
  confirmed BOOLEAN,
  tag TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  user_role TEXT  -- Role do usuário atual
) AS $$
DECLARE
  user_role_var TEXT;
BEGIN
  -- Obter role do usuário para este artista
  SELECT am.role INTO user_role_var
  FROM artist_members am
  WHERE am.user_id = auth.uid()
    AND am.artist_id = p_artist_id;
  
  -- Se não encontrou, usuário não tem acesso
  IF user_role_var IS NULL THEN
    RAISE EXCEPTION 'Usuário não tem acesso a este artista';
  END IF;

  -- Retornar eventos com colunas filtradas
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
    -- ✅ VALUE: Ocultar para VIEWER
    CASE 
      WHEN user_role_var IN ('editor', 'admin', 'owner') THEN e.value
      ELSE NULL  -- Viewer não vê
    END AS value,
    e.city,
    e.contractor_phone,
    e.confirmed,
    e.tag,
    e.created_at,
    e.updated_at,
    user_role_var AS user_role
  FROM events e
  WHERE e.artist_id = p_artist_id
  ORDER BY e.event_date DESC, e.start_time DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 4️⃣ FUNÇÃO PARA BUSCAR UM EVENTO ESPECÍFICO
-- =====================================================

CREATE OR REPLACE FUNCTION get_event_by_id_with_role(p_event_id UUID)
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
  tag TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  user_role TEXT
) AS $$
DECLARE
  user_role_var TEXT;
  event_artist_id UUID;
BEGIN
  -- Buscar artist_id do evento
  SELECT e.artist_id INTO event_artist_id
  FROM events e
  WHERE e.id = p_event_id;
  
  IF event_artist_id IS NULL THEN
    RAISE EXCEPTION 'Evento não encontrado';
  END IF;

  -- Obter role do usuário
  SELECT am.role INTO user_role_var
  FROM artist_members am
  WHERE am.user_id = auth.uid()
    AND am.artist_id = event_artist_id;
  
  IF user_role_var IS NULL THEN
    RAISE EXCEPTION 'Usuário não tem acesso a este evento';
  END IF;

  -- Retornar evento com colunas filtradas
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
    -- ✅ VALUE: Ocultar para VIEWER
    CASE 
      WHEN user_role_var IN ('editor', 'admin', 'owner') THEN e.value
      ELSE NULL
    END AS value,
    e.city,
    e.contractor_phone,
    e.confirmed,
    e.tag,
    e.created_at,
    e.updated_at,
    user_role_var AS user_role
  FROM events e
  WHERE e.id = p_event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 5️⃣ VERIFICAR FUNÇÕES CRIADAS
-- =====================================================

SELECT 
  routine_name as "Função",
  routine_type as "Tipo"
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('get_events_by_role', 'get_event_by_id_with_role', 'get_user_role_for_artist')
ORDER BY routine_name;

-- =====================================================
-- 6️⃣ VERIFICAR COLUNAS DA TABELA EVENTS
-- =====================================================

SELECT 
  column_name,
  data_type,
  ordinal_position
FROM information_schema.columns
WHERE table_name = 'events'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- =====================================================
-- 7️⃣ TESTAR (OPCIONAL)
-- =====================================================

/*
-- Descomente para testar com um artist_id real
SELECT * FROM get_events_by_role('SEU_ARTIST_ID_AQUI') LIMIT 1;
*/

-- =====================================================
-- ✅ ESTRUTURA FINAL DA FUNÇÃO
-- =====================================================
-- 
-- Colunas retornadas:
-- 1. id UUID
-- 2. artist_id UUID
-- 3. created_by UUID (quem criou o evento)
-- 4. name TEXT
-- 5. description TEXT
-- 6. event_date DATE
-- 7. start_time TIME
-- 8. end_time TIME
-- 9. value NUMERIC (NULL para viewer)
-- 10. city TEXT
-- 11. contractor_phone TEXT
-- 12. confirmed BOOLEAN
-- 13. tag TEXT
-- 14. created_at TIMESTAMP
-- 15. updated_at TIMESTAMP
-- 16. user_role TEXT (role do usuário atual)
-- 
-- ⚠️ NOTA: user_id NÃO existe na tabela events
-- Apenas created_by existe (UUID de quem criou)
-- 
-- =====================================================

