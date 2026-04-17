-- RPCs para fluxo completo de convite de participação em evento.
-- Objetivo: centralizar regras no Supabase (menos dependência do app).
--
-- Inclui:
-- 1) Enviar convite
-- 2) Aceitar convite (cria evento no convidado + despesa no evento origem)
-- 3) Recusar convite pendente (com motivo opcional)
-- 4) Cancelar convite pendente (lado de quem convidou)
-- 5) Cancelar participação já aceita (com motivo obrigatório)
--
-- Pré-requisitos:
-- - Tabela convite_participacao_evento já criada (CONVITE_PARTICIPACAO_EVENTO.sql)
-- - Colunas funcao_participacao e grupo_disputa_id (NOT NULL; ver seção 0)
-- - Tabela notifications com colunas: to_user_id, from_user_id, artist_id, title, message, type, read, created_at
-- - Tabela events com colunas: created_by, updated_by, ativo, update_ativo, convite_participacao_id

-- =====================================================
-- 0) Ajustes de schema
-- =====================================================

ALTER TABLE convite_participacao_evento
  ADD COLUMN IF NOT EXISTS despesa_origem_id UUID REFERENCES event_expenses(id) ON DELETE SET NULL;

ALTER TABLE convite_participacao_evento
  ADD COLUMN IF NOT EXISTS motivo_cancelamento TEXT;

ALTER TABLE convite_participacao_evento
  ADD COLUMN IF NOT EXISTS grupo_disputa_id UUID;

UPDATE convite_participacao_evento
SET grupo_disputa_id = gen_random_uuid()
WHERE grupo_disputa_id IS NULL;

ALTER TABLE convite_participacao_evento
  ALTER COLUMN grupo_disputa_id SET NOT NULL;

ALTER TABLE convite_participacao_evento
  ALTER COLUMN grupo_disputa_id SET DEFAULT gen_random_uuid();

CREATE INDEX IF NOT EXISTS idx_convite_part_grupo_pendente
  ON convite_participacao_evento (grupo_disputa_id)
  WHERE status = 'pendente';

COMMENT ON COLUMN convite_participacao_evento.grupo_disputa_id IS
  'Convites com o mesmo UUID disputam uma vaga (leilão). Ao aceitar um, pendentes do grupo são cancelados.';

-- Garante suporte ao tipo de notificação de participação no enum da tabela notifications.
DO $$
DECLARE
  v_enum_name TEXT;
BEGIN
  SELECT t.typname
    INTO v_enum_name
  FROM pg_attribute a
  JOIN pg_class c ON c.oid = a.attrelid
  JOIN pg_type t ON t.oid = a.atttypid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'notifications'
    AND a.attname = 'type'
    AND t.typtype = 'e'
  LIMIT 1;

  IF v_enum_name IS NOT NULL THEN
    EXECUTE format('ALTER TYPE public.%I ADD VALUE IF NOT EXISTS %L', v_enum_name, 'participacao_evento');
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_convite_part_despesa_origem
  ON convite_participacao_evento(despesa_origem_id);

-- =====================================================
-- Helpers de permissão e notificação
-- =====================================================

CREATE OR REPLACE FUNCTION public._is_member_of_artist(
  p_user_id UUID,
  p_artist_id UUID,
  p_roles TEXT[] DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM artist_members am
    WHERE am.user_id = p_user_id
      AND am.artist_id = p_artist_id
      AND (p_roles IS NULL OR am.role = ANY(p_roles))
  );
$$;

CREATE OR REPLACE FUNCTION public._notify_participacao_evento(
  p_to_user_id UUID,
  p_from_user_id UUID,
  p_artist_id UUID,
  p_title TEXT,
  p_message TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO notifications (
    to_user_id,
    from_user_id,
    artist_id,
    title,
    message,
    type,
    read,
    created_at
  ) VALUES (
    p_to_user_id,
    p_from_user_id,
    p_artist_id,
    p_title,
    p_message,
    'participacao_evento',
    false,
    NOW()
  );
END;
$$;

-- =====================================================
-- 1) Enviar convite
-- =====================================================

DROP FUNCTION IF EXISTS public.rpc_app_enviar_convite_participacao_evento(UUID, UUID, NUMERIC, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.rpc_app_enviar_convites_participacao_evento_lote(UUID, uuid[], NUMERIC, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.rpc_enviar_convites_participacao_evento_lote(UUID, uuid[], NUMERIC, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.rpc_enviar_convite_participacao_evento(UUID, UUID, NUMERIC, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.rpc_enviar_convite_participacao_evento(
  p_evento_origem_id UUID,
  p_artista_convidado_id UUID,
  p_cache_valor NUMERIC,
  p_telefone_contratante TEXT DEFAULT NULL,
  p_funcao_participacao TEXT DEFAULT NULL,
  p_mensagem TEXT DEFAULT NULL,
  p_grupo_disputa_id UUID DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  error TEXT,
  convite_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_event events%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RETURN QUERY SELECT false, 'Usuário não autenticado.', NULL::UUID;
    RETURN;
  END IF;

  IF p_cache_valor IS NULL OR p_cache_valor <= 0 THEN
    RETURN QUERY SELECT false, 'Cachê é obrigatório e deve ser maior que zero.', NULL::UUID;
    RETURN;
  END IF;

  IF NULLIF(TRIM(p_funcao_participacao), '') IS NULL THEN
    RETURN QUERY SELECT false, 'Função do participante é obrigatória.', NULL::UUID;
    RETURN;
  END IF;

  SELECT * INTO v_event
  FROM events e
  WHERE e.id = p_evento_origem_id
    AND COALESCE(e.ativo, true) = true
  LIMIT 1;

  IF v_event.id IS NULL THEN
    RETURN QUERY SELECT false, 'Evento de origem não encontrado.', NULL::UUID;
    RETURN;
  END IF;

  -- Somente editor/admin/owner do artista do evento pode enviar convite.
  IF NOT public._is_member_of_artist(v_uid, v_event.artist_id, ARRAY['editor', 'admin', 'owner']) THEN
    RETURN QUERY SELECT false, 'Sem permissão para convidar neste evento.', NULL::UUID;
    RETURN;
  END IF;

  IF v_event.artist_id = p_artista_convidado_id THEN
    RETURN QUERY SELECT false, 'Não é possível convidar o mesmo artista.', NULL::UUID;
    RETURN;
  END IF;

  BEGIN
    INSERT INTO convite_participacao_evento (
      evento_origem_id,
      artista_que_convidou_id,
      artista_convidado_id,
      status,
      mensagem,
      nome_evento,
      data_evento,
      hora_inicio,
      hora_fim,
      cache_valor,
      cidade,
      telefone_contratante,
      descricao,
      funcao_participacao,
      usuario_que_enviou_id,
      grupo_disputa_id
    )
    VALUES (
      v_event.id,
      v_event.artist_id,
      p_artista_convidado_id,
      'pendente',
      NULLIF(TRIM(p_mensagem), ''),
      v_event.name,
      v_event.event_date,
      v_event.start_time,
      v_event.end_time,
      p_cache_valor,
      v_event.city,
      NULLIF(TRIM(p_telefone_contratante), ''),
      v_event.description,
      TRIM(p_funcao_participacao),
      v_uid,
      COALESCE(p_grupo_disputa_id, gen_random_uuid())
    )
    RETURNING id INTO convite_id;

    RETURN QUERY SELECT true, NULL::TEXT, convite_id;
  EXCEPTION
    WHEN unique_violation THEN
      RETURN QUERY SELECT false, 'Já existe convite pendente para este artista neste evento.', NULL::UUID;
    WHEN OTHERS THEN
      RETURN QUERY SELECT false, SQLERRM, NULL::UUID;
  END;
END;
$$;

-- 1b) Leilão: vários convites numa transação, mesmo grupo_disputa_id (primeiro que aceitar cancela os demais do grupo).
CREATE OR REPLACE FUNCTION public.rpc_enviar_convites_participacao_evento_lote(
  p_evento_origem_id UUID,
  p_artista_convidado_ids UUID[],
  p_cache_valor NUMERIC,
  p_telefone_contratante TEXT DEFAULT NULL,
  p_funcao_participacao TEXT DEFAULT NULL,
  p_mensagem TEXT DEFAULT NULL
)
RETURNS TABLE (
  artista_convidado_id UUID,
  success BOOLEAN,
  error TEXT,
  convite_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_event events%ROWTYPE;
  v_grupo UUID := gen_random_uuid();
  v_aid UUID;
  v_new_id UUID;
  v_n INT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN QUERY SELECT NULL::UUID, false, 'Usuário não autenticado.', NULL::UUID;
    RETURN;
  END IF;

  IF p_artista_convidado_ids IS NULL OR cardinality(p_artista_convidado_ids) = 0 THEN
    RETURN QUERY SELECT NULL::UUID, false, 'Selecione pelo menos um artista.', NULL::UUID;
    RETURN;
  END IF;

  SELECT COUNT(DISTINCT x) INTO v_n FROM unnest(p_artista_convidado_ids) AS x;
  IF v_n > 40 THEN
    RETURN QUERY SELECT NULL::UUID, false, 'No máximo 40 artistas por leilão.', NULL::UUID;
    RETURN;
  END IF;

  IF p_cache_valor IS NULL OR p_cache_valor <= 0 THEN
    RETURN QUERY SELECT NULL::UUID, false, 'Cachê é obrigatório e deve ser maior que zero.', NULL::UUID;
    RETURN;
  END IF;

  IF NULLIF(TRIM(p_funcao_participacao), '') IS NULL THEN
    RETURN QUERY SELECT NULL::UUID, false, 'Função do participante é obrigatória.', NULL::UUID;
    RETURN;
  END IF;

  SELECT * INTO v_event
  FROM events e
  WHERE e.id = p_evento_origem_id
    AND COALESCE(e.ativo, true) = true
  LIMIT 1;

  IF v_event.id IS NULL THEN
    RETURN QUERY SELECT NULL::UUID, false, 'Evento de origem não encontrado.', NULL::UUID;
    RETURN;
  END IF;

  IF NOT public._is_member_of_artist(v_uid, v_event.artist_id, ARRAY['editor', 'admin', 'owner']) THEN
    RETURN QUERY SELECT NULL::UUID, false, 'Sem permissão para convidar neste evento.', NULL::UUID;
    RETURN;
  END IF;

  FOR v_aid IN SELECT DISTINCT unnest(p_artista_convidado_ids)
  LOOP
    IF v_aid = v_event.artist_id THEN
      RETURN QUERY SELECT v_aid, false, 'Não é possível convidar o próprio artista do evento.', NULL::UUID;
      CONTINUE;
    END IF;

    BEGIN
      INSERT INTO convite_participacao_evento (
        evento_origem_id,
        artista_que_convidou_id,
        artista_convidado_id,
        status,
        mensagem,
        nome_evento,
        data_evento,
        hora_inicio,
        hora_fim,
        cache_valor,
        cidade,
        telefone_contratante,
        descricao,
        funcao_participacao,
        usuario_que_enviou_id,
        grupo_disputa_id
      )
      VALUES (
        v_event.id,
        v_event.artist_id,
        v_aid,
        'pendente',
        NULLIF(TRIM(p_mensagem), ''),
        v_event.name,
        v_event.event_date,
        v_event.start_time,
        v_event.end_time,
        p_cache_valor,
        v_event.city,
        NULLIF(TRIM(p_telefone_contratante), ''),
        v_event.description,
        TRIM(p_funcao_participacao),
        v_uid,
        v_grupo
      )
      RETURNING id INTO v_new_id;

      RETURN QUERY SELECT v_aid, true, NULL::TEXT, v_new_id;
    EXCEPTION
      WHEN unique_violation THEN
        RETURN QUERY SELECT v_aid, false, 'Já existe convite pendente para este artista neste evento.', NULL::UUID;
      WHEN OTHERS THEN
        RETURN QUERY SELECT v_aid, false, SQLERRM, NULL::UUID;
    END;
  END LOOP;
END;
$$;

-- =====================================================
-- 2) Aceitar convite
--    - Cria evento na agenda do convidado
--    - Cria despesa no evento origem (Nome do convidado - Função)
--    - Cancela outros pendentes do mesmo grupo_disputa_id (leilão)
-- =====================================================

CREATE OR REPLACE FUNCTION public.rpc_aceitar_convite_participacao_evento(
  p_convite_id UUID
)
RETURNS TABLE (
  success BOOLEAN,
  error TEXT,
  evento_id UUID,
  despesa_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_convite convite_participacao_evento%ROWTYPE;
  v_nome_artista_convidado TEXT;
  v_nome_despesa TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN QUERY SELECT false, 'Usuário não autenticado.', NULL::UUID, NULL::UUID;
    RETURN;
  END IF;

  SELECT * INTO v_convite
  FROM convite_participacao_evento c
  WHERE c.id = p_convite_id
  LIMIT 1;

  IF v_convite.id IS NULL THEN
    RETURN QUERY SELECT false, 'Convite não encontrado.', NULL::UUID, NULL::UUID;
    RETURN;
  END IF;

  IF v_convite.status <> 'pendente' THEN
    RETURN QUERY SELECT false, 'Este convite não está mais pendente.', NULL::UUID, NULL::UUID;
    RETURN;
  END IF;

  -- Usuário precisa ter papel de edição no artista convidado.
  IF NOT public._is_member_of_artist(v_uid, v_convite.artista_convidado_id, ARRAY['editor', 'admin', 'owner']) THEN
    RETURN QUERY SELECT false, 'Sem permissão para aceitar este convite.', NULL::UUID, NULL::UUID;
    RETURN;
  END IF;

  IF v_convite.cache_valor IS NULL OR v_convite.cache_valor <= 0 THEN
    RETURN QUERY SELECT false, 'Convite sem cachê válido para lançar despesa.', NULL::UUID, NULL::UUID;
    RETURN;
  END IF;

  SELECT a.name INTO v_nome_artista_convidado
  FROM artists a
  WHERE a.id = v_convite.artista_convidado_id
  LIMIT 1;

  v_nome_despesa := COALESCE(v_nome_artista_convidado, 'Artista') || ' - ' ||
                    COALESCE(NULLIF(TRIM(v_convite.funcao_participacao), ''), 'Participação');

  BEGIN
    -- Trava convites pendentes do mesmo grupo (ORDER BY id evita deadlock).
    PERFORM 1
    FROM convite_participacao_evento c
    WHERE c.grupo_disputa_id = v_convite.grupo_disputa_id
      AND c.status = 'pendente'
    ORDER BY c.id
    FOR UPDATE;

    SELECT * INTO v_convite
    FROM convite_participacao_evento c
    WHERE c.id = p_convite_id
    FOR UPDATE;

    IF v_convite.status <> 'pendente' THEN
      RETURN QUERY SELECT false, 'Este convite não está mais pendente.', NULL::UUID, NULL::UUID;
      RETURN;
    END IF;

    -- 1) Criar evento no artista convidado
    INSERT INTO events (
      artist_id,
      created_by,
      updated_by,
      name,
      description,
      event_date,
      start_time,
      end_time,
      value,
      city,
      contractor_phone,
      confirmed,
      tag,
      convite_participacao_id,
      created_at,
      updated_at,
      ativo
    ) VALUES (
      v_convite.artista_convidado_id,
      v_uid,
      v_uid,
      v_convite.nome_evento,
      COALESCE(v_convite.descricao, v_convite.mensagem),
      v_convite.data_evento,
      v_convite.hora_inicio,
      v_convite.hora_fim,
      v_convite.cache_valor,
      v_convite.cidade,
      v_convite.telefone_contratante,
      true,
      'evento',
      v_convite.id,
      NOW(),
      NOW(),
      true
    )
    RETURNING id INTO evento_id;

    -- 2) Criar despesa no evento de origem
    INSERT INTO event_expenses (
      event_id,
      name,
      value,
      receipt_url,
      created_at,
      updated_at
    ) VALUES (
      v_convite.evento_origem_id,
      v_nome_despesa,
      v_convite.cache_valor,
      NULL,
      NOW(),
      NOW()
    )
    RETURNING id INTO despesa_id;

    -- 3) Atualizar convite
    UPDATE convite_participacao_evento
    SET
      status = 'aceito',
      evento_criado_convidado_id = evento_id,
      despesa_origem_id = despesa_id,
      respondido_em = NOW(),
      atualizado_em = NOW()
    WHERE id = v_convite.id
      AND status = 'pendente';

    -- 3b) Leilão: cancela demais pendentes do mesmo grupo_disputa_id.
    UPDATE convite_participacao_evento c
    SET
      status = 'cancelado',
      respondido_em = NOW(),
      atualizado_em = NOW(),
      motivo_cancelamento = 'Outro artista aceitou primeiro nesta mesma rodada de convites (leilão).'
    WHERE c.grupo_disputa_id = v_convite.grupo_disputa_id
      AND c.status = 'pendente'
      AND c.id <> v_convite.id;

    RETURN QUERY SELECT true, NULL::TEXT, evento_id, despesa_id;
  EXCEPTION
    WHEN OTHERS THEN
      RETURN QUERY SELECT false, SQLERRM, NULL::UUID, NULL::UUID;
  END;
END;
$$;

-- =====================================================
-- 3) Recusar convite pendente (lado do convidado)
-- =====================================================

CREATE OR REPLACE FUNCTION public.rpc_recusar_convite_participacao_evento(
  p_convite_id UUID,
  p_motivo TEXT DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  error TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_convite convite_participacao_evento%ROWTYPE;
  v_nome_convidado TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN QUERY SELECT false, 'Usuário não autenticado.';
    RETURN;
  END IF;

  SELECT * INTO v_convite
  FROM convite_participacao_evento
  WHERE id = p_convite_id
  LIMIT 1;

  IF v_convite.id IS NULL THEN
    RETURN QUERY SELECT false, 'Convite não encontrado.';
    RETURN;
  END IF;

  IF v_convite.status <> 'pendente' THEN
    RETURN QUERY SELECT false, 'Este convite não está pendente.';
    RETURN;
  END IF;

  IF NOT public._is_member_of_artist(v_uid, v_convite.artista_convidado_id, ARRAY['editor', 'admin', 'owner']) THEN
    RETURN QUERY SELECT false, 'Sem permissão para recusar este convite.';
    RETURN;
  END IF;

  UPDATE convite_participacao_evento
  SET
    status = 'recusado',
    respondido_em = NOW(),
    atualizado_em = NOW()
  WHERE id = v_convite.id
    AND status = 'pendente';

  SELECT name INTO v_nome_convidado
  FROM artists
  WHERE id = v_convite.artista_convidado_id
  LIMIT 1;

  PERFORM public._notify_participacao_evento(
    v_convite.usuario_que_enviou_id,
    v_uid,
    v_convite.artista_que_convidou_id,
    'Convite de participação recusado',
    COALESCE(v_nome_convidado, 'O artista convidado') ||
      ' recusou a participação no evento "' || v_convite.nome_evento || '"' ||
      CASE WHEN NULLIF(TRIM(p_motivo), '') IS NOT NULL THEN '. Motivo: ' || TRIM(p_motivo) ELSE '' END
  );

  RETURN QUERY SELECT true, NULL::TEXT;
END;
$$;

-- =====================================================
-- 4) Cancelar convite pendente (lado de quem convidou)
-- =====================================================

CREATE OR REPLACE FUNCTION public.rpc_cancelar_convite_pendente_participacao_evento(
  p_convite_id UUID
)
RETURNS TABLE (
  success BOOLEAN,
  error TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_convite convite_participacao_evento%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RETURN QUERY SELECT false, 'Usuário não autenticado.';
    RETURN;
  END IF;

  SELECT * INTO v_convite
  FROM convite_participacao_evento
  WHERE id = p_convite_id
  LIMIT 1;

  IF v_convite.id IS NULL THEN
    RETURN QUERY SELECT false, 'Convite não encontrado.';
    RETURN;
  END IF;

  IF v_convite.status <> 'pendente' THEN
    RETURN QUERY SELECT false, 'Somente convites pendentes podem ser cancelados.';
    RETURN;
  END IF;

  IF v_convite.usuario_que_enviou_id <> v_uid THEN
    RETURN QUERY SELECT false, 'Somente quem enviou o convite pode cancelá-lo.';
    RETURN;
  END IF;

  UPDATE convite_participacao_evento
  SET
    status = 'cancelado',
    respondido_em = NOW(),
    atualizado_em = NOW()
  WHERE id = v_convite.id
    AND status = 'pendente';

  RETURN QUERY SELECT true, NULL::TEXT;
END;
$$;

-- =====================================================
-- 5) Cancelar participação aceita (lado do convidado)
--    - Exige motivo
--    - Remove despesa de origem
--    - Inativa evento criado no convidado
--    - Notifica quem convidou
-- =====================================================

CREATE OR REPLACE FUNCTION public.rpc_cancelar_participacao_aceita_evento(
  p_convite_id UUID,
  p_motivo TEXT
)
RETURNS TABLE (
  success BOOLEAN,
  error TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_convite convite_participacao_evento%ROWTYPE;
  v_nome_convidado TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN QUERY SELECT false, 'Usuário não autenticado.';
    RETURN;
  END IF;

  IF NULLIF(TRIM(p_motivo), '') IS NULL THEN
    RETURN QUERY SELECT false, 'Motivo do cancelamento é obrigatório.';
    RETURN;
  END IF;

  SELECT * INTO v_convite
  FROM convite_participacao_evento
  WHERE id = p_convite_id
  LIMIT 1;

  IF v_convite.id IS NULL THEN
    RETURN QUERY SELECT false, 'Convite não encontrado.';
    RETURN;
  END IF;

  IF v_convite.status <> 'aceito' THEN
    RETURN QUERY SELECT false, 'Somente participações aceitas podem ser canceladas.';
    RETURN;
  END IF;

  IF NOT public._is_member_of_artist(v_uid, v_convite.artista_convidado_id, ARRAY['editor', 'admin', 'owner']) THEN
    RETURN QUERY SELECT false, 'Sem permissão para cancelar esta participação.';
    RETURN;
  END IF;

  -- Remove despesa vinculada ao convite.
  IF v_convite.despesa_origem_id IS NOT NULL THEN
    DELETE FROM event_expenses
    WHERE id = v_convite.despesa_origem_id;
  ELSE
    -- Fallback para convites antigos sem despesa_origem_id
    SELECT name INTO v_nome_convidado
    FROM artists
    WHERE id = v_convite.artista_convidado_id
    LIMIT 1;

    DELETE FROM event_expenses ee
    WHERE ee.event_id = v_convite.evento_origem_id
      AND ee.value = v_convite.cache_valor
      AND (
        ee.name = COALESCE(v_nome_convidado, 'Artista') || ' - ' || COALESCE(NULLIF(TRIM(v_convite.funcao_participacao), ''), 'Participação')
        OR (v_nome_convidado IS NOT NULL AND ee.name ILIKE v_nome_convidado || ' - %')
      );
  END IF;

  -- Inativa evento criado no artista convidado.
  IF v_convite.evento_criado_convidado_id IS NOT NULL THEN
    UPDATE events
    SET
      ativo = false,
      update_ativo = NOW(),
      updated_at = NOW(),
      updated_by = v_uid
    WHERE id = v_convite.evento_criado_convidado_id;
  END IF;

  UPDATE convite_participacao_evento
  SET
    status = 'cancelado',
    motivo_cancelamento = TRIM(p_motivo),
    respondido_em = NOW(),
    atualizado_em = NOW()
  WHERE id = v_convite.id
    AND status = 'aceito';

  SELECT name INTO v_nome_convidado
  FROM artists
  WHERE id = v_convite.artista_convidado_id
  LIMIT 1;

  PERFORM public._notify_participacao_evento(
    v_convite.usuario_que_enviou_id,
    v_uid,
    v_convite.artista_que_convidou_id,
    'Participação cancelada pelo convidado',
    COALESCE(v_nome_convidado, 'O artista convidado') ||
      ' cancelou a participação no evento "' || v_convite.nome_evento || '". Motivo: ' || TRIM(p_motivo)
  );

  RETURN QUERY SELECT true, NULL::TEXT;
END;
$$;

-- =====================================================
-- 5b) Remover participação aceita (lado do anfitrião / organizador do evento)
--     Mesmo efeito do cancelamento pelo convidado: remove despesa, inativa evento do convidado,
--     marca convite cancelado e notifica o convidado.
-- =====================================================

CREATE OR REPLACE FUNCTION public.rpc_cancelar_participacao_aceita_pelo_anfitriao_evento(
  p_convite_id UUID,
  p_motivo TEXT
)
RETURNS TABLE (
  success BOOLEAN,
  error TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_convite convite_participacao_evento%ROWTYPE;
  v_nome_convidado TEXT;
  v_nome_organizador TEXT;
  v_to_user_id UUID;
BEGIN
  IF v_uid IS NULL THEN
    RETURN QUERY SELECT false, 'Usuário não autenticado.';
    RETURN;
  END IF;

  IF NULLIF(TRIM(p_motivo), '') IS NULL THEN
    RETURN QUERY SELECT false, 'Motivo da remoção é obrigatório.';
    RETURN;
  END IF;

  SELECT * INTO v_convite
  FROM convite_participacao_evento
  WHERE id = p_convite_id
  LIMIT 1;

  IF v_convite.id IS NULL THEN
    RETURN QUERY SELECT false, 'Convite não encontrado.';
    RETURN;
  END IF;

  IF v_convite.status <> 'aceito' THEN
    RETURN QUERY SELECT false, 'Somente participações já aceitas podem ser removidas pelo organizador.';
    RETURN;
  END IF;

  IF NOT public._is_member_of_artist(v_uid, v_convite.artista_que_convidou_id, ARRAY['editor', 'admin', 'owner']) THEN
    RETURN QUERY SELECT false, 'Sem permissão para remover esta participação.';
    RETURN;
  END IF;

  IF v_convite.despesa_origem_id IS NOT NULL THEN
    DELETE FROM event_expenses
    WHERE id = v_convite.despesa_origem_id;
  ELSE
    SELECT name INTO v_nome_convidado
    FROM artists
    WHERE id = v_convite.artista_convidado_id
    LIMIT 1;

    DELETE FROM event_expenses ee
    WHERE ee.event_id = v_convite.evento_origem_id
      AND ee.value = v_convite.cache_valor
      AND (
        ee.name = COALESCE(v_nome_convidado, 'Artista') || ' - ' || COALESCE(NULLIF(TRIM(v_convite.funcao_participacao), ''), 'Participação')
        OR (v_nome_convidado IS NOT NULL AND ee.name ILIKE v_nome_convidado || ' - %')
      );
  END IF;

  IF v_convite.evento_criado_convidado_id IS NOT NULL THEN
    UPDATE events
    SET
      ativo = false,
      update_ativo = NOW(),
      updated_at = NOW(),
      updated_by = v_uid
    WHERE id = v_convite.evento_criado_convidado_id;
  END IF;

  UPDATE convite_participacao_evento
  SET
    status = 'cancelado',
    motivo_cancelamento = TRIM(p_motivo),
    respondido_em = NOW(),
    atualizado_em = NOW()
  WHERE id = v_convite.id
    AND status = 'aceito';

  SELECT name INTO v_nome_organizador
  FROM artists
  WHERE id = v_convite.artista_que_convidou_id
  LIMIT 1;

  SELECT am.user_id INTO v_to_user_id
  FROM artist_members am
  WHERE am.artist_id = v_convite.artista_convidado_id
  ORDER BY CASE am.role
    WHEN 'owner' THEN 1
    WHEN 'admin' THEN 2
    WHEN 'editor' THEN 3
    WHEN 'viewer' THEN 4
    ELSE 99
  END, am.created_at ASC
  LIMIT 1;

  IF v_to_user_id IS NOT NULL THEN
    PERFORM public._notify_participacao_evento(
      v_to_user_id,
      v_uid,
      v_convite.artista_convidado_id,
      'Participação removida pelo organizador',
      COALESCE(v_nome_organizador, 'O organizador') ||
        ' removeu sua participação no evento "' || v_convite.nome_evento ||
        '". Motivo: ' || TRIM(p_motivo)
    );
  END IF;

  RETURN QUERY SELECT true, NULL::TEXT;
END;
$$;

-- =====================================================
-- Permissões de execução
-- =====================================================

GRANT EXECUTE ON FUNCTION public.rpc_enviar_convite_participacao_evento(UUID, UUID, NUMERIC, TEXT, TEXT, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_enviar_convites_participacao_evento_lote(UUID, uuid[], NUMERIC, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_aceitar_convite_participacao_evento(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_recusar_convite_participacao_evento(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_cancelar_convite_pendente_participacao_evento(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_cancelar_participacao_aceita_evento(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_cancelar_participacao_aceita_pelo_anfitriao_evento(UUID, TEXT) TO authenticated;

-- =====================================================
-- Camada estável para o app (evita problemas de assinatura/cache)
-- =====================================================

-- Remove assinatura antiga de compatibilidade, se existir no banco.
DROP FUNCTION IF EXISTS public.rpc_enviar_convite_participacao_evento(UUID, NUMERIC, UUID, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.rpc_app_enviar_convite_participacao_evento(
  p_evento_origem_id UUID,
  p_artista_convidado_id UUID,
  p_cache_valor NUMERIC,
  p_telefone_contratante TEXT DEFAULT NULL,
  p_funcao_participacao TEXT DEFAULT NULL,
  p_mensagem TEXT DEFAULT NULL,
  p_grupo_disputa_id UUID DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  error TEXT,
  convite_id UUID
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.rpc_enviar_convite_participacao_evento(
    p_evento_origem_id => p_evento_origem_id,
    p_artista_convidado_id => p_artista_convidado_id,
    p_cache_valor => p_cache_valor,
    p_telefone_contratante => p_telefone_contratante,
    p_funcao_participacao => p_funcao_participacao,
    p_mensagem => p_mensagem,
    p_grupo_disputa_id => p_grupo_disputa_id
  );
$$;

CREATE OR REPLACE FUNCTION public.rpc_app_enviar_convites_participacao_evento_lote(
  p_evento_origem_id UUID,
  p_artista_convidado_ids UUID[],
  p_cache_valor NUMERIC,
  p_telefone_contratante TEXT DEFAULT NULL,
  p_funcao_participacao TEXT DEFAULT NULL,
  p_mensagem TEXT DEFAULT NULL
)
RETURNS TABLE (
  artista_convidado_id UUID,
  success BOOLEAN,
  error TEXT,
  convite_id UUID
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.rpc_enviar_convites_participacao_evento_lote(
    p_evento_origem_id => p_evento_origem_id,
    p_artista_convidado_ids => p_artista_convidado_ids,
    p_cache_valor => p_cache_valor,
    p_telefone_contratante => p_telefone_contratante,
    p_funcao_participacao => p_funcao_participacao,
    p_mensagem => p_mensagem
  );
$$;

CREATE OR REPLACE FUNCTION public.rpc_app_notificar_convite_participacao_evento(
  p_convite_id UUID
)
RETURNS TABLE (
  success BOOLEAN,
  error TEXT,
  to_user_id UUID,
  token_fcm TEXT,
  title TEXT,
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_convite convite_participacao_evento%ROWTYPE;
  v_inviter_name TEXT;
  v_to_user_id UUID;
  v_token_fcm TEXT;
  v_title TEXT := 'Convite de participação em evento';
  v_message TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN QUERY SELECT false, 'Usuário não autenticado.', NULL::UUID, NULL::TEXT, NULL::TEXT, NULL::TEXT;
    RETURN;
  END IF;

  SELECT * INTO v_convite
  FROM convite_participacao_evento
  WHERE id = p_convite_id
  LIMIT 1;

  IF v_convite.id IS NULL THEN
    RETURN QUERY SELECT false, 'Convite não encontrado.', NULL::UUID, NULL::TEXT, NULL::TEXT, NULL::TEXT;
    RETURN;
  END IF;

  -- Apenas quem enviou o convite pode disparar esta notificação.
  IF v_convite.usuario_que_enviou_id <> v_uid THEN
    RETURN QUERY SELECT false, 'Sem permissão para notificar este convite.', NULL::UUID, NULL::TEXT, NULL::TEXT, NULL::TEXT;
    RETURN;
  END IF;

  -- Escolher destinatário principal: owner > admin > editor > viewer.
  SELECT am.user_id, u.token_fcm
    INTO v_to_user_id, v_token_fcm
  FROM artist_members am
  LEFT JOIN users u ON u.id = am.user_id
  WHERE am.artist_id = v_convite.artista_convidado_id
    AND am.user_id <> v_uid
  ORDER BY CASE am.role
    WHEN 'owner' THEN 1
    WHEN 'admin' THEN 2
    WHEN 'editor' THEN 3
    WHEN 'viewer' THEN 4
    ELSE 99
  END, am.created_at ASC
  LIMIT 1;

  IF v_to_user_id IS NULL THEN
    RETURN QUERY SELECT false, 'Não foi possível encontrar destinatário principal para o convite.', NULL::UUID, NULL::TEXT, NULL::TEXT, NULL::TEXT;
    RETURN;
  END IF;

  SELECT a.name INTO v_inviter_name
  FROM artists a
  WHERE a.id = v_convite.artista_que_convidou_id
  LIMIT 1;

  v_message :=
    COALESCE(v_inviter_name, 'Um artista') ||
    ' convidou você para participar de "' || v_convite.nome_evento || '".';

  PERFORM public._notify_participacao_evento(
    v_to_user_id,
    v_uid,
    v_convite.artista_convidado_id,
    v_title,
    v_message
  );

  RETURN QUERY SELECT true, NULL::TEXT, v_to_user_id, v_token_fcm, v_title, v_message;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_app_aceitar_convite_participacao_evento(
  p_convite_id UUID
)
RETURNS TABLE (
  success BOOLEAN,
  error TEXT,
  evento_id UUID,
  despesa_id UUID
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.rpc_aceitar_convite_participacao_evento(
    p_convite_id => p_convite_id
  );
$$;

CREATE OR REPLACE FUNCTION public.rpc_app_recusar_convite_participacao_evento(
  p_convite_id UUID,
  p_motivo TEXT DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  error TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.rpc_recusar_convite_participacao_evento(
    p_convite_id => p_convite_id,
    p_motivo => p_motivo
  );
$$;

CREATE OR REPLACE FUNCTION public.rpc_app_cancelar_convite_pendente_participacao_evento(
  p_convite_id UUID
)
RETURNS TABLE (
  success BOOLEAN,
  error TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.rpc_cancelar_convite_pendente_participacao_evento(
    p_convite_id => p_convite_id
  );
$$;

CREATE OR REPLACE FUNCTION public.rpc_app_cancelar_participacao_aceita_evento(
  p_convite_id UUID,
  p_motivo TEXT
)
RETURNS TABLE (
  success BOOLEAN,
  error TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.rpc_cancelar_participacao_aceita_evento(
    p_convite_id => p_convite_id,
    p_motivo => p_motivo
  );
$$;

CREATE OR REPLACE FUNCTION public.rpc_app_cancelar_participacao_aceita_pelo_anfitriao_evento(
  p_convite_id UUID,
  p_motivo TEXT
)
RETURNS TABLE (
  success BOOLEAN,
  error TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.rpc_cancelar_participacao_aceita_pelo_anfitriao_evento(
    p_convite_id => p_convite_id,
    p_motivo => p_motivo
  );
$$;

GRANT EXECUTE ON FUNCTION public.rpc_app_enviar_convite_participacao_evento(UUID, UUID, NUMERIC, TEXT, TEXT, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_app_enviar_convites_participacao_evento_lote(UUID, uuid[], NUMERIC, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_app_notificar_convite_participacao_evento(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_app_aceitar_convite_participacao_evento(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_app_recusar_convite_participacao_evento(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_app_cancelar_convite_pendente_participacao_evento(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_app_cancelar_participacao_aceita_evento(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_app_cancelar_participacao_aceita_pelo_anfitriao_evento(UUID, TEXT) TO authenticated;

-- =====================================================
-- Lista convites por eventos de origem (avatares na agenda)
-- SECURITY DEFINER: garante todos os convidados visíveis ao organizador,
-- sem depender de RLS linha-a-linha no cliente.
-- =====================================================

CREATE OR REPLACE FUNCTION public.rpc_app_convites_agenda_avatars(p_event_ids uuid[])
RETURNS TABLE (
  evento_origem_id uuid,
  artista_que_convidou_id uuid,
  artista_convidado_id uuid,
  criado_em timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.evento_origem_id,
    c.artista_que_convidou_id,
    c.artista_convidado_id,
    c.criado_em
  FROM convite_participacao_evento c
  INNER JOIN events e ON e.id = c.evento_origem_id
  WHERE
    p_event_ids IS NOT NULL
    AND cardinality(p_event_ids) > 0
    AND c.evento_origem_id = ANY (p_event_ids)
    AND c.status IN ('pendente', 'aceito')
    AND (
      EXISTS (
        SELECT 1
        FROM artist_members am
        WHERE am.artist_id = e.artist_id
          AND am.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1
        FROM convite_participacao_evento c0
        WHERE c0.evento_origem_id = c.evento_origem_id
          AND EXISTS (
            SELECT 1
            FROM artist_members am0
            WHERE am0.artist_id = c0.artista_convidado_id
              AND am0.user_id = auth.uid()
          )
      )
    );
$$;

GRANT EXECUTE ON FUNCTION public.rpc_app_convites_agenda_avatars(uuid[]) TO authenticated;

-- Ajuda o PostgREST a recarregar schema cache (quando suportado).
NOTIFY pgrst, 'reload schema';

