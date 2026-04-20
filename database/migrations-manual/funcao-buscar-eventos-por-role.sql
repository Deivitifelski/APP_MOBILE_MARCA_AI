-- =====================================================
-- FUNÇÃO RPC PARA BUSCAR EVENTOS BASEADO NA ROLE
-- Retorna eventos com colunas filtradas por permissão
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
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
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
    user_role_var AS user_role  -- Incluir role na resposta
  FROM events e
  WHERE e.artist_id = p_artist_id
  ORDER BY e.event_date DESC, e.start_time DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FUNÇÃO PARA BUSCAR UM EVENTO ESPECÍFICO
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
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
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
-- TESTAR AS FUNÇÕES
-- =====================================================

-- Buscar todos os eventos de um artista
SELECT * FROM get_events_by_role('SEU_ARTIST_ID_AQUI');

-- Buscar um evento específico
SELECT * FROM get_event_by_id_with_role('SEU_EVENT_ID_AQUI');

-- =====================================================
-- COMO USAR NO CÓDIGO TYPESCRIPT
-- =====================================================

/*
// services/supabase/eventService.ts

// Buscar eventos de um artista com role filtering
export const getEventsByArtistWithRole = async (artistId: string) => {
  try {
    const { data, error } = await supabase
      .rpc('get_events_by_role', { p_artist_id: artistId });

    if (error) {
      console.error('Erro ao buscar eventos:', error);
      return { events: null, error: error.message };
    }

    // data já vem com:
    // - value = NULL se for viewer
    // - value = valor real se for editor/admin/owner
    // - user_role incluído na resposta
    
    return { events: data, error: null };
  } catch (error) {
    return { events: null, error: 'Erro ao buscar eventos' };
  }
};

// Buscar um evento específico
export const getEventByIdWithRole = async (eventId: string) => {
  try {
    const { data, error } = await supabase
      .rpc('get_event_by_id_with_role', { p_event_id: eventId });

    if (error) {
      return { event: null, error: error.message };
    }

    return { event: data?.[0] || null, error: null };
  } catch (error) {
    return { event: null, error: 'Erro ao buscar evento' };
  }
};
*/

-- =====================================================
-- VANTAGENS DA FUNÇÃO RPC
-- =====================================================
-- 
-- ✅ Mais flexível que VIEW
-- ✅ Pode receber parâmetros
-- ✅ Pode ter lógica complexa
-- ✅ Centraliza a segurança no banco
-- ✅ Melhor performance que filtrar no código
-- ✅ Seguro - SECURITY DEFINER executa com privilégios do criador
-- 
-- =====================================================

-- =====================================================
-- COMPARAÇÃO: VIEW vs FUNÇÃO RPC
-- =====================================================
-- 
-- VIEW:
-- - Mais simples de usar (SELECT * FROM view)
-- - Comporta-se como uma tabela
-- - Melhor para queries complexas com JOINs
-- 
-- FUNÇÃO RPC:
-- - Mais flexível
-- - Pode receber parâmetros
-- - Pode ter validações e lógica complexa
-- - Melhor para casos de uso específicos
-- 
-- RECOMENDAÇÃO: Use função RPC para maior controle
-- =====================================================

