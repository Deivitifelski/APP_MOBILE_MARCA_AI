-- =====================================================
-- Trial gratuito: exportar financeiro e abrir detalhes
-- Execute no SQL Editor do Supabase após deploy do app.
-- =====================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS free_financial_trial_exports_used integer NOT NULL DEFAULT 0 CHECK (free_financial_trial_exports_used >= 0),
  ADD COLUMN IF NOT EXISTS free_financial_trial_detail_opens_used integer NOT NULL DEFAULT 0 CHECK (free_financial_trial_detail_opens_used >= 0);

COMMENT ON COLUMN public.users.free_financial_trial_exports_used IS 'Contador de exportações financeiras (PDF/cópia) no trial gratuito.';
COMMENT ON COLUMN public.users.free_financial_trial_detail_opens_used IS 'Contador de aberturas da tela de detalhes financeiros no trial gratuito.';

CREATE OR REPLACE FUNCTION public.get_financial_trial_status()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  premium boolean;
  exu int;
  dou int;
  lim int := 3;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authed');
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.user_subscriptions s
    WHERE s.user_id = uid
      AND s.status IN ('active', 'grace_period')
      AND (s.expires_at IS NULL OR s.expires_at > now())
  ) INTO premium;

  SELECT
    COALESCE(u.free_financial_trial_exports_used, 0),
    COALESCE(u.free_financial_trial_detail_opens_used, 0)
  INTO exu, dou
  FROM public.users u
  WHERE u.id = uid;
  exu := COALESCE(exu, 0);
  dou := COALESCE(dou, 0);

  RETURN jsonb_build_object(
    'premium', premium,
    'exportsUsed', exu,
    'exportsLimit', lim,
    'exportsRemaining', GREATEST(0, lim - exu),
    'detailOpensUsed', dou,
    'detailOpensLimit', lim,
    'detailOpensRemaining', GREATEST(0, lim - dou)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.consume_financial_trial_action(p_kind text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  premium boolean;
  exu int;
  dou int;
  lim int := 3;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authed');
  END IF;

  IF p_kind IS NULL OR p_kind NOT IN ('export', 'detail_open') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_kind');
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.user_subscriptions s
    WHERE s.user_id = uid
      AND s.status IN ('active', 'grace_period')
      AND (s.expires_at IS NULL OR s.expires_at > now())
  ) INTO premium;

  IF premium THEN
    RETURN jsonb_build_object('ok', true, 'reason', 'premium');
  END IF;

  SELECT
    COALESCE(u.free_financial_trial_exports_used, 0),
    COALESCE(u.free_financial_trial_detail_opens_used, 0)
  INTO exu, dou
  FROM public.users u
  WHERE u.id = uid
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'user_not_found');
  END IF;

  IF p_kind = 'export' THEN
    IF exu >= lim THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'exhausted_exports');
    END IF;
    UPDATE public.users
    SET
      free_financial_trial_exports_used = exu + 1,
      updated_at = now()
    WHERE id = uid;
    RETURN jsonb_build_object('ok', true, 'reason', 'trial', 'remaining', lim - exu - 1);
  END IF;

  IF dou >= lim THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'exhausted_details');
  END IF;
  UPDATE public.users
  SET
    free_financial_trial_detail_opens_used = dou + 1,
    updated_at = now()
  WHERE id = uid;
  RETURN jsonb_build_object('ok', true, 'reason', 'trial', 'remaining', lim - dou - 1);
END;
$$;

REVOKE ALL ON FUNCTION public.get_financial_trial_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_financial_trial_status() TO authenticated;

REVOKE ALL ON FUNCTION public.consume_financial_trial_action(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_financial_trial_action(text) TO authenticated;

COMMENT ON FUNCTION public.get_financial_trial_status() IS 'Retorna premium (user_subscriptions) e usos restantes do trial de export/detalhes financeiros.';
COMMENT ON FUNCTION public.consume_financial_trial_action(text) IS 'Consome 1 uso do trial (export ou detail_open); premium não incrementa contadores.';
