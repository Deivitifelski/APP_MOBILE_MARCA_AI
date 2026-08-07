-- Adiciona uma descrição separada, voltada para colaboradores viewer, distinta da
-- descrição interna (`description`, vista só por admin/vendedor).
-- `viewer_description` é sempre visível para qualquer membro do artista (inclusive viewer),
-- já que é opt-in: só existe conteúdo ali se o admin/vendedor explicitamente escreveu algo
-- pensando em quem vai ler.
--
-- Baseado na versão atual de RPC_GET_EVENTS_ADD_VENDEDOR_ROLE.sql (state_uf, soft delete via
-- `ativo`, timestamptz).
--
-- IMPORTANTE: mudar o RETURNS TABLE de uma função existente (mesmo só acrescentando uma coluna
-- no final) NÃO é aceito por CREATE OR REPLACE FUNCTION — o Postgres recusa com "cannot change
-- return type of existing function". É sempre necessário DROP FUNCTION antes. Por isso usamos
-- DROP FUNCTION IF EXISTS + CREATE FUNCTION dentro de uma transação (BEGIN/COMMIT): isso deixa a
-- troca atômica — outras sessões que chamarem a função durante a transação ficam bloqueadas por
-- uma fração de segundo em vez de ver "function does not exist".
--
-- Compatibilidade com apps já publicados: o Supabase (PostgREST) devolve cada linha da RPC como
-- objeto JSON chaveado por NOME de coluna, não por posição. Então essa mudança é aditiva do ponto
-- de vista do cliente: apps antigos que só leem os campos que já conheciam continuam funcionando
-- sem alteração nenhuma — o campo novo só existe pra quem souber procurar por ele. É seguro rodar
-- essa migration em prod antes de publicar a nova versão do app.
--
-- Rode no SQL Editor do Supabase.

BEGIN;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS viewer_description TEXT;

DROP FUNCTION IF EXISTS public.get_events_by_role(uuid);
DROP FUNCTION IF EXISTS public.get_event_by_id_with_role(uuid);

CREATE FUNCTION public.get_events_by_role(p_artist_id UUID)
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
  state_uf TEXT,
  contractor_phone TEXT,
  confirmed BOOLEAN,
  tag TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  user_role TEXT,
  viewer_description TEXT
) AS $$
DECLARE
  user_role_var TEXT;
BEGIN
  SELECT am.role INTO user_role_var
  FROM artist_members am
  WHERE am.user_id = auth.uid()
    AND am.artist_id = p_artist_id;

  IF user_role_var IS NULL THEN
    RAISE EXCEPTION 'Usuário não tem acesso a este artista';
  END IF;

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
    CASE
      WHEN user_role_var IN ('admin', 'owner') THEN e.value
      WHEN user_role_var = 'vendedor' AND e.created_by = auth.uid() THEN e.value
      ELSE NULL
    END AS value,
    e.city,
    e.state_uf,
    e.contractor_phone,
    e.confirmed,
    e.tag,
    e.created_at::timestamptz,
    e.updated_at::timestamptz,
    user_role_var AS user_role,
    e.viewer_description
  FROM events e
  WHERE e.artist_id = p_artist_id
    AND e.ativo IS TRUE
  ORDER BY e.event_date DESC, e.start_time DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE FUNCTION public.get_event_by_id_with_role(p_event_id UUID)
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
  state_uf TEXT,
  contractor_phone TEXT,
  confirmed BOOLEAN,
  tag TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  user_role TEXT,
  viewer_description TEXT
) AS $$
DECLARE
  user_role_var TEXT;
  event_artist_id UUID;
BEGIN
  SELECT e.artist_id INTO event_artist_id
  FROM events e
  WHERE e.id = p_event_id
    AND e.ativo IS TRUE;

  IF event_artist_id IS NULL THEN
    RAISE EXCEPTION 'Evento não encontrado';
  END IF;

  SELECT am.role INTO user_role_var
  FROM artist_members am
  WHERE am.user_id = auth.uid()
    AND am.artist_id = event_artist_id;

  IF user_role_var IS NULL THEN
    RAISE EXCEPTION 'Usuário não tem acesso a este evento';
  END IF;

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
    CASE
      WHEN user_role_var IN ('admin', 'owner') THEN e.value
      WHEN user_role_var = 'vendedor' AND e.created_by = auth.uid() THEN e.value
      ELSE NULL
    END AS value,
    e.city,
    e.state_uf,
    e.contractor_phone,
    e.confirmed,
    e.tag,
    e.created_at::timestamptz,
    e.updated_at::timestamptz,
    user_role_var AS user_role,
    e.viewer_description
  FROM events e
  WHERE e.id = p_event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.get_events_by_role(UUID) IS 'Eventos ativos do artista; value oculto para viewer; vendedor vê value só do que criou; inclui state_uf e viewer_description.';

COMMIT;

-- =====================================================
-- Verificação rápida
-- =====================================================
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('get_events_by_role', 'get_event_by_id_with_role');
