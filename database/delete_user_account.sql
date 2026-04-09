-- =====================================================
-- Exclusão completa da conta do usuário autenticado
-- Substitui / alinha a RPC chamada pelo app: delete_user_account(p_uid)
--
-- Regras:
-- - p_uid DEVE ser igual a auth.uid() (ignora UUID forjado pelo cliente).
-- - Papéis "gerentes": admin OU owner (único gerente → apaga o artista inteiro).
-- - Tudo em UMA transação: se qualquer passo falhar (incl. DELETE em auth.users), nada é aplicado.
-- - Ao final: DELETE em auth.users (função SECURITY DEFINER como postgres no Supabase costuma ter permissão).
-- - Eventos: suporta coluna legada user_id e/ou created_by + updated_by (detecção via information_schema).
--
-- Executar no SQL Editor do Supabase como postgres.
-- =====================================================

CREATE OR REPLACE FUNCTION public.delete_user_account(p_uid uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  v_artist_id uuid;
  v_managers int;
  n_artists_deleted int := 0;
  n_members_removed int := 0;
  n_step int;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object(
      'status', 'error',
      'error', 'Usuário não autenticado'
    );
  END IF;

  IF p_uid IS NULL OR p_uid <> uid THEN
    RETURN jsonb_build_object(
      'status', 'error',
      'error', 'Operação inválida: confirme a sessão atual.'
    );
  END IF;

  -- 1) Artistas em que o usuário é admin ou owner: ou apaga o artista (único gerente) ou só a membership
  FOR v_artist_id IN
    SELECT DISTINCT am.artist_id
    FROM public.artist_members am
    WHERE am.user_id = uid
      AND am.role IN ('admin', 'owner')
  LOOP
    SELECT COUNT(*)::int
    INTO v_managers
    FROM public.artist_members m
    WHERE m.artist_id = v_artist_id
      AND m.role IN ('admin', 'owner');

    IF v_managers <= 1 THEN
      DELETE FROM public.artists a WHERE a.id = v_artist_id;
      IF FOUND THEN
        n_artists_deleted := n_artists_deleted + 1;
      END IF;
    ELSE
      DELETE FROM public.artist_members m
      WHERE m.artist_id = v_artist_id
        AND m.user_id = uid;
      GET DIAGNOSTICS n_step = ROW_COUNT;
      n_members_removed := n_members_removed + n_step;
    END IF;
  END LOOP;

  -- 2) Qualquer membership restante (editor/viewer ou casos edge)
  DELETE FROM public.artist_members m WHERE m.user_id = uid;
  GET DIAGNOSTICS n_step = ROW_COUNT;
  n_members_removed := n_members_removed + n_step;

  -- 3) Notificações envolvendo o usuário
  IF to_regclass('public.notifications') IS NOT NULL THEN
    DELETE FROM public.notifications n
    WHERE n.to_user_id = uid OR n.from_user_id = uid;
  END IF;

  -- 4) Convites de colaborador
  IF to_regclass('public.artist_invites') IS NOT NULL THEN
    DELETE FROM public.artist_invites i
    WHERE i.to_user_id = uid OR i.from_user_id = uid;
  END IF;

  -- 5) Convites de participação em evento (enviados por este usuário)
  IF to_regclass('public.convite_participacao_evento') IS NOT NULL THEN
    DELETE FROM public.convite_participacao_evento c
    WHERE c.usuario_que_enviou_id = uid;
  END IF;

  -- 6) Assinaturas / trial em tabela dedicada
  IF to_regclass('public.user_subscriptions') IS NOT NULL THEN
    DELETE FROM public.user_subscriptions s WHERE s.user_id = uid;
  END IF;

  -- 7) Feedback
  IF to_regclass('public.feedback_usuario') IS NOT NULL THEN
    DELETE FROM public.feedback_usuario f WHERE f.user_id = uid;
  END IF;

  -- 8) Eventos ligados ao usuário (remove FKs para auth antes do passo 12)
  IF to_regclass('public.events') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns c
      WHERE c.table_schema = 'public' AND c.table_name = 'events' AND c.column_name = 'user_id'
    ) THEN
      EXECUTE 'DELETE FROM public.events WHERE user_id = $1' USING uid;
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns c
      WHERE c.table_schema = 'public' AND c.table_name = 'events' AND c.column_name = 'updated_by'
    ) THEN
      EXECUTE 'UPDATE public.events SET updated_by = NULL WHERE updated_by = $1' USING uid;
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns c
      WHERE c.table_schema = 'public' AND c.table_name = 'events' AND c.column_name = 'created_by'
    ) THEN
      EXECUTE 'DELETE FROM public.events WHERE created_by = $1' USING uid;
    END IF;
  END IF;

  -- 9) Auditoria de despesas (se existir)
  IF to_regclass('public.event_audit_log') IS NOT NULL THEN
    DELETE FROM public.event_audit_log l WHERE l.actor_user_id = uid;
  END IF;

  -- 10) Metas mensais: limpa updated_by (FK comum para auth)
  IF to_regclass('public.meta_mensal_artista') IS NOT NULL THEN
    UPDATE public.meta_mensal_artista mm
    SET updated_by = NULL
    WHERE mm.updated_by = uid;
  END IF;

  -- 11) Perfil público
  IF to_regclass('public.users') IS NOT NULL THEN
    DELETE FROM public.users u WHERE u.id = uid;
  END IF;

  -- 12) Auth (se falhar, a transação inteira é revertida — evita apagar dados públicos e manter login)
  DELETE FROM auth.users au WHERE au.id = uid;

  RETURN jsonb_build_object(
    'status', 'ok',
    'message', 'Conta removida e dados relacionados apagados.',
    'details', jsonb_build_object(
      'artists_deleted', n_artists_deleted,
      'memberships_removed', n_members_removed
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.delete_user_account(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_user_account(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_user_account(uuid) TO service_role;

COMMENT ON FUNCTION public.delete_user_account(uuid) IS
  'Exclui a conta do usuário autenticado (p_uid deve ser auth.uid()). Atômica: falha em auth.users reverte tudo.';
