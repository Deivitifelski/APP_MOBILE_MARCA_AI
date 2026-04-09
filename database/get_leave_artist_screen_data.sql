-- =====================================================
-- Uma única chamada para a tela "Sair do artista"
-- (substitui getCollaborators + validateLeaveArtist + assertArtistTeamSlot)
-- Executar no SQL Editor do Supabase (postgres).
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_leave_artist_screen_data(p_artist_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid;
  v_role text;
  total_collab int;
  total_admins int;
  is_admin_role boolean;
  v jsonb;
  others int;
BEGIN
  uid := auth.uid();
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated', 'validation', NULL);
  END IF;

  SELECT am.role INTO v_role
  FROM public.artist_members am
  WHERE am.artist_id = p_artist_id
    AND am.user_id = uid;

  IF v_role IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_member', 'validation', NULL);
  END IF;

  SELECT
    COUNT(*)::int,
    COUNT(*) FILTER (WHERE role = 'admin')::int
  INTO total_collab, total_admins
  FROM public.artist_members
  WHERE artist_id = p_artist_id;

  IF total_collab = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_collaborators', 'validation', NULL);
  END IF;

  is_admin_role := (v_role = 'admin');
  others := total_collab - 1;

  -- Espelha a lógica de services/supabase/leaveArtistValidation.ts (role admin apenas)

  IF NOT is_admin_role THEN
    v := jsonb_build_object(
      'canLeave', true,
      'isOnlyCollaborator', false,
      'totalCollaborators', total_collab,
      'userRole', v_role,
      'isOnlyAdmin', false,
      'totalAdmins', total_admins,
      'action', 'LEAVE_NORMALLY',
      'title', 'Sair do Artista',
      'message', 'Ao sair, você perderá acesso a todos os dados e funcionalidades deste artista.',
      'buttonText', 'Sair do Artista',
      'buttonColor', 'primary',
      'warning', jsonb_build_array(
        'Você será removido da lista de colaboradores',
        'Perderá acesso aos eventos do artista',
        'Não poderá mais visualizar ou editar dados',
        format('O artista continuará existindo para os outros %s colaboradores', others)
      )
    );
    RETURN jsonb_build_object('ok', true, 'error', NULL, 'validation', v);
  END IF;

  IF total_collab = 1 THEN
    v := jsonb_build_object(
      'canLeave', false,
      'isOnlyCollaborator', true,
      'totalCollaborators', total_collab,
      'userRole', v_role,
      'isOnlyAdmin', true,
      'totalAdmins', total_admins,
      'action', 'DELETE_ARTIST',
      'title', '⚠️ Você é o Único Colaborador',
      'message', 'Ao sair deste artista, ele será deletado permanentemente junto com todos os dados associados.',
      'buttonText', 'Deletar Artista',
      'buttonColor', 'error',
      'warning', jsonb_build_array(
        'Artista será deletado permanentemente',
        'Todos os eventos serão removidos',
        'Todas as despesas serão removidas',
        'Todos os dados financeiros serão perdidos',
        'Esta ação NÃO PODE SER DESFEITA'
      )
    );
    RETURN jsonb_build_object('ok', true, 'error', NULL, 'validation', v);
  END IF;

  IF total_admins > 1 THEN
    v := jsonb_build_object(
      'canLeave', true,
      'isOnlyCollaborator', false,
      'totalCollaborators', total_collab,
      'userRole', v_role,
      'isOnlyAdmin', false,
      'totalAdmins', total_admins,
      'action', 'LEAVE_NORMALLY',
      'title', 'Sair do Artista',
      'message', 'Ao sair, você perderá acesso a todos os dados e funcionalidades deste artista.',
      'buttonText', 'Sair do Artista',
      'buttonColor', 'primary',
      'warning', jsonb_build_array(
        'Você será removido da lista de colaboradores',
        'Perderá acesso aos eventos do artista',
        'Outro admin continuará gerenciando o artista',
        format('O artista continuará existindo para os outros %s colaboradores', others)
      )
    );
    RETURN jsonb_build_object('ok', true, 'error', NULL, 'validation', v);
  END IF;

  IF total_admins = 1 THEN
    v := jsonb_build_object(
      'canLeave', false,
      'isOnlyCollaborator', false,
      'totalCollaborators', total_collab,
      'userRole', v_role,
      'isOnlyAdmin', true,
      'totalAdmins', total_admins,
      'action', 'TRANSFER_ADMIN',
      'title', '⚠️ Você é o Único Administrador',
      'message', 'Para sair, você deve indicar outro colaborador para ser admin ou deletar o artista.',
      'buttonText', 'Escolher Ação',
      'buttonColor', 'warning',
      'warning', jsonb_build_array(
        format('Existem %s outros colaboradores no artista', others),
        'Você precisa escolher um novo admin',
        'Ou pode deletar o artista e remover todos os dados'
      )
    );
    RETURN jsonb_build_object('ok', true, 'error', NULL, 'validation', v);
  END IF;

  -- Caso padrão (ex.: sem linha admin contada mas usuário é admin — mantém saída normal)
  v := jsonb_build_object(
    'canLeave', true,
    'isOnlyCollaborator', false,
    'totalCollaborators', total_collab,
    'userRole', v_role,
    'isOnlyAdmin', false,
    'totalAdmins', total_admins,
    'action', 'LEAVE_NORMALLY',
    'title', 'Sair do Artista',
    'message', 'Ao sair, você perderá acesso a todos os dados e funcionalidades deste artista.',
    'buttonText', 'Sair do Artista',
    'buttonColor', 'primary',
    'warning', jsonb_build_array(
      'Você será removido da lista de colaboradores',
      'Perderá acesso aos eventos do artista',
      'Não poderá mais visualizar ou editar dados',
      format('O artista continuará existindo para os outros %s colaboradores', others)
    )
  );
  RETURN jsonb_build_object('ok', true, 'error', NULL, 'validation', v);
END;
$$;

REVOKE ALL ON FUNCTION public.get_leave_artist_screen_data(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_leave_artist_screen_data(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_leave_artist_screen_data(uuid) TO service_role;

COMMENT ON FUNCTION public.get_leave_artist_screen_data(uuid) IS
  'Dados para a tela Sair do artista: validação + contagens em uma ida ao banco (auth.uid() deve ser membro do artista).';
