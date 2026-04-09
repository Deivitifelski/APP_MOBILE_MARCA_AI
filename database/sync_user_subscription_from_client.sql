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
  v_expires_from_store timestamptz;
  v_existing_tx_id uuid;
  v_existing_sub_id uuid;
  v_billing text;
  v_plan_active boolean;
  v_product text;
BEGIN
  uid := auth.uid();
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  -- Reconcile sem loja: expira apenas linhas “da loja”. Linhas manuais
  -- (metadata.source = 'manual_db') permanecem active para cortesias / testes.
  IF p_reconcile_clear THEN
    UPDATE public.user_subscriptions
    SET status = 'expired'
    WHERE user_id = uid
      AND status IN ('active', 'grace_period', 'pending')
      AND COALESCE(metadata->>'source', '') <> 'manual_db';

    UPDATE public.users u
    SET plan_is_active = public.user_subscription_is_active(u.id)
    WHERE u.id = uid;

    RETURN jsonb_build_object('ok', true, 'action', 'cleared');
  END IF;

  IF p_product_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_product');
  END IF;

  v_product := btrim(p_product_id);
  IF v_product = '' OR v_product NOT IN (
    'marcaai_mensal_app',
    'marcaai_anual_app',
    'marcaai_mensal',
    'marcaai_anual'
  ) THEN
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
    -- App só marca pendente; ASN V2 (webhook) passa a active após confirmação da Apple.
    v_status := 'pending';
  END IF;

  IF p_purchased_at_ms IS NOT NULL THEN
    v_purchased := to_timestamp(p_purchased_at_ms / 1000.0);
  ELSE
    v_purchased := NULL;
  END IF;

  IF p_expires_at_ms IS NOT NULL THEN
    v_expires_from_store := to_timestamp(p_expires_at_ms / 1000.0);
  ELSE
    v_expires_from_store := NULL;
  END IF;

  -- SKU fixo (PT/EN por nome do produto na loja) — não usar só LIKE '%annual%'
  -- senão marcaai_anual_app cai no ELSE e vira monthly.
  v_billing := CASE v_product
    WHEN 'marcaai_anual_app' THEN 'annual'
    WHEN 'marcaai_anual' THEN 'annual'
    WHEN 'marcaai_mensal_app' THEN 'monthly'
    WHEN 'marcaai_mensal' THEN 'monthly'
    ELSE 'monthly'
  END;

  SELECT id INTO v_existing_tx_id
  FROM public.user_subscriptions
  WHERE user_id = uid AND store_latest_transaction_id = v_tx
  LIMIT 1;

  IF v_existing_tx_id IS NOT NULL THEN
    UPDATE public.user_subscriptions SET
      product_id = v_product,
      billing_period = v_billing,
      platform = p_platform,
      status = CASE
        WHEN v_status = 'expired' THEN 'expired'
        WHEN COALESCE((metadata->>'apple_store_confirmed')::boolean, false)
          AND status IN ('active', 'grace_period') THEN status
        ELSE 'pending'
      END,
      purchased_at = v_purchased,
      expires_at = CASE
        WHEN v_status = 'expired' THEN v_expires_from_store
        WHEN COALESCE((metadata->>'apple_store_confirmed')::boolean, false)
          AND status IN ('active', 'grace_period') THEN COALESCE(v_expires_from_store, expires_at)
        ELSE clock_timestamp() + interval '1 day'
      END,
      auto_renew = COALESCE(p_auto_renew, TRUE),
      metadata = CASE
        WHEN COALESCE((metadata->>'apple_store_confirmed')::boolean, false) THEN
          metadata
            || jsonb_build_object(
              'client_resync_at_ms', v_now_ms,
              'source', COALESCE(nullif(btrim(p_source), ''), metadata->>'source', 'client_sync')
            )
        ELSE jsonb_build_object(
          'source', COALESCE(nullif(btrim(p_source), ''), 'client_sync'),
          'purchaseTokenPresent', (p_purchase_token IS NOT NULL AND btrim(p_purchase_token) <> ''),
          'apple_store_confirmed', false,
          'client_sync_at_ms', v_now_ms,
          'store_expires_at_client_ms', p_expires_at_ms
        )
      END
    WHERE id = v_existing_tx_id;

    SELECT
      CASE
        WHEN s.status = 'revoked' OR s.status = 'expired' THEN false
        WHEN s.status IN ('active', 'grace_period') THEN true
        WHEN s.status = 'pending'
          AND s.expires_at IS NOT NULL
          AND s.expires_at > clock_timestamp()
          AND COALESCE((s.metadata->>'apple_store_confirmed')::boolean, false) = false
          THEN true
        ELSE false
      END
    INTO v_plan_active
    FROM public.user_subscriptions s
    WHERE s.id = v_existing_tx_id;

    UPDATE public.users SET plan_is_active = COALESCE(v_plan_active, false) WHERE id = uid;
    RETURN jsonb_build_object('ok', true, 'action', 'noop_idempotent');
  END IF;

  SELECT id INTO v_existing_sub_id
  FROM public.user_subscriptions
  WHERE user_id = uid AND store_original_transaction_id = v_orig
  LIMIT 1;

  IF v_existing_sub_id IS NOT NULL THEN
    UPDATE public.user_subscriptions SET
      product_id = v_product,
      billing_period = v_billing,
      platform = p_platform,
      status = CASE
        WHEN v_status = 'expired' THEN 'expired'
        WHEN COALESCE((metadata->>'apple_store_confirmed')::boolean, false)
          AND status IN ('active', 'grace_period') THEN status
        ELSE 'pending'
      END,
      purchased_at = v_purchased,
      expires_at = CASE
        WHEN v_status = 'expired' THEN v_expires_from_store
        WHEN COALESCE((metadata->>'apple_store_confirmed')::boolean, false)
          AND status IN ('active', 'grace_period') THEN COALESCE(v_expires_from_store, expires_at)
        ELSE clock_timestamp() + interval '1 day'
      END,
      cancelled_at = NULL,
      store_original_transaction_id = v_orig,
      store_latest_transaction_id = v_tx,
      auto_renew = COALESCE(p_auto_renew, TRUE),
      metadata = CASE
        WHEN COALESCE((metadata->>'apple_store_confirmed')::boolean, false) THEN
          metadata
            || jsonb_build_object(
              'client_resync_at_ms', v_now_ms,
              'source', COALESCE(nullif(btrim(p_source), ''), metadata->>'source', 'client_sync')
            )
        ELSE jsonb_build_object(
          'source', COALESCE(nullif(btrim(p_source), ''), 'client_sync'),
          'purchaseTokenPresent', (p_purchase_token IS NOT NULL AND btrim(p_purchase_token) <> ''),
          'apple_store_confirmed', false,
          'client_sync_at_ms', v_now_ms,
          'store_expires_at_client_ms', p_expires_at_ms
        )
      END
    WHERE id = v_existing_sub_id;

    SELECT
      CASE
        WHEN s.status = 'revoked' OR s.status = 'expired' THEN false
        WHEN s.status IN ('active', 'grace_period') THEN true
        WHEN s.status = 'pending'
          AND s.expires_at IS NOT NULL
          AND s.expires_at > clock_timestamp()
          AND COALESCE((s.metadata->>'apple_store_confirmed')::boolean, false) = false
          THEN true
        ELSE false
      END
    INTO v_plan_active
    FROM public.user_subscriptions s
    WHERE s.id = v_existing_sub_id;

    UPDATE public.users SET plan_is_active = COALESCE(v_plan_active, false) WHERE id = uid;
    RETURN jsonb_build_object('ok', true, 'action', 'updated');
  END IF;

  -- Nova compra IAP (pending): só expira outras pendentes da loja; não mexe em active/grace (webhook troca depois).
  IF v_status = 'pending' THEN
    UPDATE public.user_subscriptions
    SET status = 'expired'
    WHERE user_id = uid
      AND status = 'pending'
      AND COALESCE(metadata->>'source', '') <> 'manual_db';
  END IF;

  -- Pending: expires_at = +1 dia (janela até o webhook); expired: data real da loja.
  IF v_status = 'pending' THEN
    v_expires := clock_timestamp() + interval '1 day';
  ELSE
    v_expires := v_expires_from_store;
  END IF;

  INSERT INTO public.user_subscriptions (
    user_id, product_id, billing_period, platform, status,
    purchased_at, expires_at, cancelled_at,
    store_original_transaction_id, store_latest_transaction_id,
    auto_renew, metadata
  ) VALUES (
    uid, v_product, v_billing, p_platform, v_status,
    v_purchased, v_expires, NULL,
    v_orig, v_tx,
    COALESCE(p_auto_renew, TRUE),
    jsonb_build_object(
      'source', COALESCE(nullif(btrim(p_source), ''), 'client_sync'),
      'purchaseTokenPresent', (p_purchase_token IS NOT NULL AND btrim(p_purchase_token) <> ''),
      'apple_store_confirmed', false,
      'client_sync_at_ms', v_now_ms,
      'store_expires_at_client_ms', p_expires_at_ms
    )
  );

  v_plan_active := (v_status = 'pending');
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
  'IAP: pending com expires_at = agora+1 dia; plan_is_active true enquanto pending na janela (Premium). Webhook confirma → active. store_expires_at_client_ms no metadata.';
