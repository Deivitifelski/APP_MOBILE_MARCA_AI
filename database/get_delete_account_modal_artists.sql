-- =====================================================
-- Lista de artistas do usuário para o modal "Excluir conta"
-- (substitui artist_members + artists em 2 chamadas pelo app)
-- Executar no SQL Editor do Supabase (postgres).
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_delete_account_modal_artists()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN '[]'::jsonb
    ELSE COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', a.id,
            'name', a.name,
            'profile_url', a.profile_url,
            'musical_style', a.musical_style,
            'role', am.role,
            'created_at', a.created_at,
            'updated_at', a.updated_at
          )
          ORDER BY a.name
        )
        FROM public.artist_members am
        INNER JOIN public.artists a ON a.id = am.artist_id
        WHERE am.user_id = auth.uid()
      ),
      '[]'::jsonb
    )
  END;
$$;

REVOKE ALL ON FUNCTION public.get_delete_account_modal_artists() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_delete_account_modal_artists() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_delete_account_modal_artists() TO service_role;

COMMENT ON FUNCTION public.get_delete_account_modal_artists() IS
  'Artistas em que auth.uid() é membro (para aviso no modal de exclusão de conta).';
