-- =====================================================
-- Verificação de Premium a partir de user_subscriptions
-- (status active/grace_period e expires_at válido)
-- Executar no SQL Editor do Supabase após a tabela existir.
-- =====================================================

CREATE OR REPLACE FUNCTION public.user_subscription_is_active(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_subscriptions s
    WHERE s.user_id = p_user_id
      AND s.status IN ('active', 'grace_period')
      AND (s.expires_at IS NULL OR s.expires_at > now())
  );
$$;

REVOKE ALL ON FUNCTION public.user_subscription_is_active(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_subscription_is_active(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_subscription_is_active(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.any_users_have_active_subscription(p_user_ids uuid[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    EXISTS (
      SELECT 1
      FROM public.user_subscriptions s
      WHERE s.user_id = ANY (p_user_ids)
        AND s.status IN ('active', 'grace_period')
        AND (s.expires_at IS NULL OR s.expires_at > now())
    ),
    false
  );
$$;

REVOKE ALL ON FUNCTION public.any_users_have_active_subscription(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.any_users_have_active_subscription(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.any_users_have_active_subscription(uuid[]) TO service_role;

COMMENT ON FUNCTION public.user_subscription_is_active(uuid) IS
  'Indica se o usuário tem assinatura vigente em user_subscriptions (fonte para Premium no app).';

COMMENT ON FUNCTION public.any_users_have_active_subscription(uuid[]) IS
  'Indica se algum dos usuários tem assinatura vigente (ex.: time do artista).';
