-- =====================================================
-- Liberar Premium manualmente no banco (testes / equipe)
-- =====================================================
-- No bloco DECLARE abaixo, use UMA das opções:
--
--   A) Defina v_user com o UUID (copie de Authentication → Users no Supabase,
--      ou rode: SELECT id, email FROM auth.users ORDER BY created_at DESC LIMIT 20;)
--
--   B) OU defina v_lookup_email com o e-mail da conta e deixe v_user = NULL.
--
-- Depois execute só o bloco DO $$ ... END $$;
--
-- O script expira assinaturas active/grace antigas, insere user_subscriptions active
-- e atualiza users.plan_is_active = true.
--
-- Aviso: o app pode expirar isso no reconcile se não houver compra na loja.
-- =====================================================

DO $$
DECLARE
  -- Opção A: UUID do usuário (substitua NULL pelo id, ex.: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid)
  v_user uuid := NULL;

  -- Opção B: e-mail do usuário em auth.users (se usar isto, mantenha v_user = NULL)
  v_lookup_email text := NULL;

  v_suffix text := replace(gen_random_uuid()::text, '-', '');
  v_orig text;
  v_tx text;
BEGIN
  IF v_lookup_email IS NOT NULL AND btrim(v_lookup_email) <> '' THEN
    SELECT au.id
    INTO v_user
    FROM auth.users au
    WHERE lower(au.email) = lower(btrim(v_lookup_email))
    LIMIT 1;
    IF v_user IS NULL THEN
      RAISE EXCEPTION
        'E-mail não encontrado em auth.users: "%". Confira o cadastro em Authentication → Users.',
        btrim(v_lookup_email);
    END IF;
  END IF;

  IF v_user IS NULL THEN
    RAISE EXCEPTION
      'Configure o script: no DECLARE, defina v_user := ''SEU-UUID''::uuid OU v_lookup_email := ''email@exemplo.com''. Não deixe os dois vazios.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_user) THEN
    RAISE EXCEPTION 'UUID não encontrado em auth.users: %', v_user;
  END IF;

  v_orig := 'manual_grant_' || v_suffix || '_orig';
  v_tx := 'manual_grant_' || v_suffix || '_txn';

  UPDATE public.user_subscriptions
  SET
    status = 'expired',
    updated_at = now()
  WHERE user_id = v_user
    AND status IN ('active', 'grace_period');

  INSERT INTO public.user_subscriptions (
    user_id,
    product_id,
    billing_period,
    platform,
    status,
    purchased_at,
    expires_at,
    cancelled_at,
    store_original_transaction_id,
    store_latest_transaction_id,
    auto_renew,
    metadata
  ) VALUES (
    v_user,
    'marcaai_anual_app',
    'annual',
    'ios',
    'active',
    now(),
    now() + interval '1 year',
    NULL,
    v_orig,
    v_tx,
    true,
    jsonb_build_object(
      'source', 'manual_db_grant',
      'granted_at', now()
    )
  );

  UPDATE public.users
  SET
    plan_is_active = true,
    updated_at = now()
  WHERE id = v_user;
END $$;

-- Conferir (ajuste o filtro)
-- SELECT id, email FROM auth.users WHERE email ilike '%parte%';
-- SELECT * FROM public.user_subscriptions WHERE user_id = 'UUID-AQUI' ORDER BY updated_at DESC LIMIT 3;
