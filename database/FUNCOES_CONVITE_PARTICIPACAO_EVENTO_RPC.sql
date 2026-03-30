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
-- - Coluna funcao_participacao já criada
-- - Tabela notifications com colunas: to_user_id, from_user_id, artist_id, title, message, type, read, created_at
-- - Tabela events com colunas: created_by, updated_by, ativo, update_ativo, convite_participacao_id

-- =====================================================
-- 0) Ajustes de schema
-- =====================================================

ALTER TABLE convite_participacao_evento
  ADD COLUMN IF NOT EXISTS despesa_origem_id UUID REFERENCES event_expenses(id) ON DELETE SET NULL;

ALTER TABLE convite_participacao_evento
  ADD COLUMN IF NOT EXISTS motivo_cancelamento TEXT;

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

CREATE OR REPLACE FUNCTION public.rpc_enviar_convite_participacao_evento(
  p_evento_origem_id UUID,
  p_artista_convidado_id UUID,
  p_cache_valor NUMERIC,
  p_telefone_contratante TEXT DEFAULT NULL,
  p_funcao_participacao TEXT DEFAULT NULL,
  p_mensagem TEXT DEFAULT NULL
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
      usuario_que_enviou_id
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
      v_uid
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

-- =====================================================
-- 2) Aceitar convite
--    - Cria evento na agenda do convidado
--    - Cria despesa no evento origem (Nome do convidado - Função)
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
-- Permissões de execução
-- =====================================================

GRANT EXECUTE ON FUNCTION public.rpc_enviar_convite_participacao_evento(UUID, UUID, NUMERIC, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_aceitar_convite_participacao_evento(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_recusar_convite_participacao_evento(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_cancelar_convite_pendente_participacao_evento(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_cancelar_participacao_aceita_evento(UUID, TEXT) TO authenticated;

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
  p_mensagem TEXT DEFAULT NULL
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
    p_mensagem => p_mensagem
  );
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

GRANT EXECUTE ON FUNCTION public.rpc_app_enviar_convite_participacao_evento(UUID, UUID, NUMERIC, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_app_aceitar_convite_participacao_evento(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_app_recusar_convite_participacao_evento(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_app_cancelar_convite_pendente_participacao_evento(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_app_cancelar_participacao_aceita_evento(UUID, TEXT) TO authenticated;

-- Ajuda o PostgREST a recarregar schema cache (quando suportado).
NOTIFY pgrst, 'reload schema';

