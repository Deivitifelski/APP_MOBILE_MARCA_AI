-- =====================================================
-- RPC: sincronizar assinatura IAP → user_subscriptions + users.plan_is_active
-- Executar no SQL Editor do Supabase (como postgres).
-- O app chama: supabase.rpc('sync_user_subscription_from_client', { ... })
-- Usa auth.uid() — não confie em user_id vindo do cliente.
-- =====================================================

CREATE OR REPLACE FUNCTION public.sync_user_subscription_from_client(
  p_reconcile_clear boolean DEFAULT false,
  p_product_id text DEFAULT NULL,
  p_platform text DEFAULT NULL,
  p_transaction_id text DEFAULT NULL,
  p_original_transaction_id text DEFAULT NULL,
  p_purchase_token text DEFAULT NULL,
  p_expires_at_ms bigint DEFAULT NULL,
  p_purchased_at_ms bigint DEFAULT NULL,
  p_auto_renew boolean DEFAULT TRUE,
  p_source text DEFAULT 'client_sync'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid;
  v_tx text;
  v_orig text;
  v_now_ms bigint;
  v_status text;
  v_purchased timestamptz;
  v_expires timestamptz;
  v_existing_tx_id uuid;
  v_existing_sub_id uuid;
  v_billing text;
  v_plan_active boolean;
BEGIN
  uid := auth.uid();
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  IF p_reconcile_clear THEN
    UPDATE public.user_subscriptions
    SET status = 'expired'
    WHERE user_id = uid AND status IN ('active', 'grace_period');

    UPDATE public.users SET plan_is_active = false WHERE id = uid;
    RETURN jsonb_build_object('ok', true, 'action', 'cleared');
  END IF;

  IF p_product_id IS NULL OR btrim(p_product_id) = '' OR p_product_id NOT IN ('marcaai_mensal_app', 'marcaai_anual_app') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_product');
  END IF;

  IF p_platform IS NULL OR p_platform NOT IN ('ios', 'android') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_platform');
  END IF;

  v_tx := nullif(btrim(coalesce(p_transaction_id, '')), '');
  IF v_tx IS NULL AND p_purchase_token IS NOT NULL AND btrim(p_purchase_token) <> '' THEN
    v_tx := 'gplay:' || left(btrim(p_purchase_token), 120);
  END IF;

  IF v_tx IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_transaction_or_token');
  END IF;

  v_orig := nullif(btrim(coalesce(p_original_transaction_id, '')), '');
  IF v_orig IS NULL THEN
    v_orig := v_tx;
  END IF;

  v_now_ms := (EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint;
  IF p_expires_at_ms IS NOT NULL AND p_expires_at_ms < v_now_ms THEN
    v_status := 'expired';
  ELSE
    v_status := 'active';
  END IF;

  IF p_purchased_at_ms IS NOT NULL THEN
    v_purchased := to_timestamp(p_purchased_at_ms / 1000.0);
  ELSE
    v_purchased := NULL;
  END IF;

  IF p_expires_at_ms IS NOT NULL THEN
    v_expires := to_timestamp(p_expires_at_ms / 1000.0);
  ELSE
    v_expires := NULL;
  END IF;

  IF lower(p_product_id) LIKE '%anual%' OR lower(p_product_id) LIKE '%annual%' OR lower(p_product_id) LIKE '%year%' THEN
    v_billing := 'annual';
  ELSIF lower(p_product_id) LIKE '%mensal%' OR lower(p_product_id) LIKE '%month%' THEN
    v_billing := 'monthly';
  ELSE
    v_billing := 'monthly';
  END IF;

  SELECT id INTO v_existing_tx_id
  FROM public.user_subscriptions
  WHERE user_id = uid AND store_latest_transaction_id = v_tx
  LIMIT 1;

  IF v_existing_tx_id IS NOT NULL THEN
    v_plan_active :=
      CASE
        WHEN v_status = 'revoked' THEN false
        WHEN v_status = 'expired' THEN false
        WHEN v_status IN ('active', 'grace_period') THEN true
        WHEN v_expires IS NOT NULL AND v_expires > now() THEN true
        ELSE false
      END;
    UPDATE public.users SET plan_is_active = v_plan_active WHERE id = uid;
    RETURN jsonb_build_object('ok', true, 'action', 'noop_idempotent');
  END IF;

  SELECT id INTO v_existing_sub_id
  FROM public.user_subscriptions
  WHERE user_id = uid AND store_original_transaction_id = v_orig
  LIMIT 1;

  IF v_existing_sub_id IS NOT NULL THEN
    UPDATE public.user_subscriptions SET
      product_id = p_product_id,
      billing_period = v_billing,
      platform = p_platform,
      status = v_status,
      purchased_at = v_purchased,
      expires_at = v_expires,
      cancelled_at = NULL,
      store_original_transaction_id = v_orig,
      store_latest_transaction_id = v_tx,
      auto_renew = COALESCE(p_auto_renew, TRUE),
      metadata = jsonb_build_object(
        'source', COALESCE(nullif(btrim(p_source), ''), 'client_sync'),
        'purchaseTokenPresent', (p_purchase_token IS NOT NULL AND btrim(p_purchase_token) <> '')
      )
    WHERE id = v_existing_sub_id;

    v_plan_active :=
      CASE
        WHEN v_status = 'revoked' THEN false
        WHEN v_status = 'expired' THEN false
        WHEN v_status IN ('active', 'grace_period') THEN true
        WHEN v_expires IS NOT NULL AND v_expires > now() THEN true
        ELSE false
      END;
    UPDATE public.users SET plan_is_active = v_plan_active WHERE id = uid;
    RETURN jsonb_build_object('ok', true, 'action', 'updated');
  END IF;

  IF v_status IN ('active', 'grace_period') THEN
    UPDATE public.user_subscriptions
    SET status = 'expired'
    WHERE user_id = uid AND status IN ('active', 'grace_period');
  END IF;

  INSERT INTO public.user_subscriptions (
    user_id, product_id, billing_period, platform, status,
    purchased_at, expires_at, cancelled_at,
    store_original_transaction_id, store_latest_transaction_id,
    auto_renew, metadata
  ) VALUES (
    uid, p_product_id, v_billing, p_platform, v_status,
    v_purchased, v_expires, NULL,
    v_orig, v_tx,
    COALESCE(p_auto_renew, TRUE),
    jsonb_build_object(
      'source', COALESCE(nullif(btrim(p_source), ''), 'client_sync'),
      'purchaseTokenPresent', (p_purchase_token IS NOT NULL AND btrim(p_purchase_token) <> '')
    )
  );

  v_plan_active :=
    CASE
      WHEN v_status = 'revoked' THEN false
      WHEN v_status = 'expired' THEN false
      WHEN v_status IN ('active', 'grace_period') THEN true
      WHEN v_expires IS NOT NULL AND v_expires > now() THEN true
      ELSE false
    END;
  UPDATE public.users SET plan_is_active = v_plan_active WHERE id = uid;

  RETURN jsonb_build_object('ok', true, 'action', 'inserted');
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unique_violation');
  WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', 'db_error', 'detail', SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION public.sync_user_subscription_from_client(
  boolean, text, text, text, text, text, bigint, bigint, boolean, text
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.sync_user_subscription_from_client(
  boolean, text, text, text, text, text, bigint, bigint, boolean, text
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.sync_user_subscription_from_client(
  boolean, text, text, text, text, text, bigint, bigint, boolean, text
) TO service_role;

COMMENT ON FUNCTION public.sync_user_subscription_from_client IS
  'Sincroniza compra/restauração IAP do app: grava user_subscriptions e atualiza users.plan_is_active.';
