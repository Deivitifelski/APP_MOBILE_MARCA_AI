-- Adiciona a role 'vendedor' às funções que retornam eventos filtrados por permissão.
-- Vendedor enxerga como o viewer, EXCETO: também vê o campo `value` (cachê) nos eventos
-- que ele mesmo criou (created_by = auth.uid()). Nos demais eventos, value continua NULL.
--
-- Baseado na versão atual de RPC_RESTORE_GET_EVENTS_ORIGINAL.sql (state_uf, soft delete via
-- `ativo`, timestamptz). Roda como CREATE OR REPLACE — substitui a função existente sem
-- precisar de DROP, então não há janela de indisponibilidade.
--
-- Rode no SQL Editor do Supabase.

CREATE OR REPLACE FUNCTION public.get_events_by_role(p_artist_id UUID)
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
  user_role TEXT
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
    user_role_var AS user_role
  FROM events e
  WHERE e.artist_id = p_artist_id
    AND e.ativo IS TRUE
    AND e.feed_tipo IS NULL
  ORDER BY e.event_date DESC, e.start_time DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_event_by_id_with_role(p_event_id UUID)
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
  user_role TEXT
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
    user_role_var AS user_role
  FROM events e
  WHERE e.id = p_event_id
    AND e.ativo IS TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.get_events_by_role(UUID) IS 'Eventos ativos do artista; value oculto para viewer; vendedor vê value só do que criou; inclui state_uf.';

-- =====================================================
-- RLS: permitir que 'vendedor' crie eventos (INSERT em `events`)
-- =====================================================
-- Política aditiva e nova (não remove/substitui a policy existente de admin).
-- Múltiplas políticas permissivas para o mesmo comando são combinadas com OR pelo Postgres,
-- então isso só AMPLIA quem pode inserir — não afeta admin/viewer já configurados.

DROP POLICY IF EXISTS "vendedor_pode_criar_eventos" ON public.events;

CREATE POLICY "vendedor_pode_criar_eventos"
ON public.events
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM artist_members am
    WHERE am.user_id = auth.uid()
      AND am.artist_id = events.artist_id
      AND am.role = 'vendedor'
  )
);

-- Vendedor pode editar e fazer soft delete apenas dos eventos que criou.
-- As policies permissivas existentes para admin continuam valendo para os demais casos.
DROP POLICY IF EXISTS "vendedor_pode_editar_proprios_eventos" ON public.events;

CREATE POLICY "vendedor_pode_editar_proprios_eventos"
ON public.events
FOR UPDATE
TO authenticated
USING (
  created_by = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM artist_members am
    WHERE am.user_id = auth.uid()
      AND am.artist_id = events.artist_id
      AND am.role = 'vendedor'
  )
)
WITH CHECK (
  created_by = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM artist_members am
    WHERE am.user_id = auth.uid()
      AND am.artist_id = events.artist_id
      AND am.role = 'vendedor'
  )
);

DROP POLICY IF EXISTS "vendedor_pode_deletar_proprios_eventos" ON public.events;

CREATE POLICY "vendedor_pode_deletar_proprios_eventos"
ON public.events
FOR DELETE
TO authenticated
USING (
  created_by = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM artist_members am
    WHERE am.user_id = auth.uid()
      AND am.artist_id = events.artist_id
      AND am.role = 'vendedor'
  )
);

-- Vendedor também pode consultar e gerenciar despesas dos próprios eventos.
DROP POLICY IF EXISTS "vendedor_pode_ver_despesas_proprios_eventos" ON public.event_expenses;
CREATE POLICY "vendedor_pode_ver_despesas_proprios_eventos"
ON public.event_expenses
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.events e
    JOIN public.artist_members am ON am.artist_id = e.artist_id
    WHERE e.id = event_expenses.event_id
      AND e.created_by = auth.uid()
      AND am.user_id = auth.uid()
      AND am.role = 'vendedor'
  )
);

DROP POLICY IF EXISTS "vendedor_pode_adicionar_despesas_proprios_eventos" ON public.event_expenses;
CREATE POLICY "vendedor_pode_adicionar_despesas_proprios_eventos"
ON public.event_expenses
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.events e
    JOIN public.artist_members am ON am.artist_id = e.artist_id
    WHERE e.id = event_expenses.event_id
      AND e.created_by = auth.uid()
      AND am.user_id = auth.uid()
      AND am.role = 'vendedor'
  )
);

DROP POLICY IF EXISTS "vendedor_pode_editar_despesas_proprios_eventos" ON public.event_expenses;
CREATE POLICY "vendedor_pode_editar_despesas_proprios_eventos"
ON public.event_expenses
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.events e
    JOIN public.artist_members am ON am.artist_id = e.artist_id
    WHERE e.id = event_expenses.event_id
      AND e.created_by = auth.uid()
      AND am.user_id = auth.uid()
      AND am.role = 'vendedor'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.events e
    JOIN public.artist_members am ON am.artist_id = e.artist_id
    WHERE e.id = event_expenses.event_id
      AND e.created_by = auth.uid()
      AND am.user_id = auth.uid()
      AND am.role = 'vendedor'
  )
);

DROP POLICY IF EXISTS "vendedor_pode_deletar_despesas_proprios_eventos" ON public.event_expenses;
CREATE POLICY "vendedor_pode_deletar_despesas_proprios_eventos"
ON public.event_expenses
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.events e
    JOIN public.artist_members am ON am.artist_id = e.artist_id
    WHERE e.id = event_expenses.event_id
      AND e.created_by = auth.uid()
      AND am.user_id = auth.uid()
      AND am.role = 'vendedor'
  )
);

-- =====================================================
-- CHECK constraint em notifications.role: ainda não aceita 'vendedor'
-- (ver database/migrations-manual/adicionar-role-notifications.sql).
-- Descobre o nome real do constraint (pode não ser o padrão notifications_role_check)
-- e recria incluindo 'vendedor'.
-- =====================================================

DO $$
DECLARE
  constraint_name_var TEXT;
BEGIN
  SELECT con.conname INTO constraint_name_var
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = ANY(con.conkey)
  WHERE rel.relname = 'notifications'
    AND att.attname = 'role'
    AND con.contype = 'c';

  IF constraint_name_var IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.notifications DROP CONSTRAINT %I', constraint_name_var);
  END IF;

  ALTER TABLE public.notifications
    ADD CONSTRAINT notifications_role_check CHECK (role IN ('viewer', 'vendedor', 'admin', 'owner'));
END $$;

-- =====================================================
-- Verificação rápida
-- =====================================================
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('get_events_by_role', 'get_event_by_id_with_role');

SELECT policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'events';
