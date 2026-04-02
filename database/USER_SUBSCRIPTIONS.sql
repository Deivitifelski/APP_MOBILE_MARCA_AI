-- =====================================================
-- Tabela: assinaturas in-app (mensal / anual)
-- Marca AI — Supabase (SQL Editor ou migration)
-- =====================================================
-- Registra compras/renovações vindas da App Store / Play Store.
-- IDs de produto no app: marcaai_mensal_app, marcaai_anual_app
-- =====================================================

CREATE TABLE IF NOT EXISTS user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Dono da assinatura (mesmo id de auth.users / public.users)
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,

  -- SKU na loja (ex.: marcaai_mensal_app, marcaai_anual_app)
  product_id TEXT NOT NULL,

  -- Período de cobrança (derivado do produto; facilita relatórios)
  billing_period TEXT NOT NULL CHECK (billing_period IN ('monthly', 'annual')),

  -- Loja
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android')),

  -- Ciclo de vida da assinatura
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN (
      'pending',       -- aguardando confirmação da loja
      'active',        -- ativa e paga
      'grace_period',  -- em período de tolerância (se aplicável)
      'cancelled',     -- cancelada pelo usuário (pode seguir válida até expires_at)
      'expired',       -- expirou sem renovação
      'revoked'        -- reembolso / revogada pela loja
    )),

  -- Datas (preencher com dados da loja quando disponíveis)
  purchased_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,

  -- Apple: original_transaction_id agrupa todas as renovações do mesmo ciclo
  -- Google: purchaseToken ou orderId (o que você enviar do cliente/webhook)
  store_original_transaction_id TEXT,
  store_latest_transaction_id TEXT,

  auto_renew BOOLEAN DEFAULT TRUE,

  -- JSON livre para payload bruto, debug ou campos futuros
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Um usuário só pode ter uma assinatura “vigente” por vez (ativa ou em tolerância)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_user_subscriptions_one_active
  ON user_subscriptions (user_id)
  WHERE status IN ('active', 'grace_period');

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id
  ON user_subscriptions (user_id);

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status
  ON user_subscriptions (status);

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_expires_at
  ON user_subscriptions (expires_at)
  WHERE expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_product_id
  ON user_subscriptions (product_id);

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_store_original
  ON user_subscriptions (store_original_transaction_id)
  WHERE store_original_transaction_id IS NOT NULL;

COMMENT ON TABLE user_subscriptions IS 'Histórico/registro de assinaturas Premium (mensal e anual) por usuário.';
COMMENT ON COLUMN user_subscriptions.product_id IS 'SKU na App Store / Play Store (ex.: marcaai_mensal_app).';
COMMENT ON COLUMN user_subscriptions.billing_period IS 'monthly ou annual, alinhado ao produto.';
COMMENT ON COLUMN user_subscriptions.store_original_transaction_id IS 'Apple: original_transaction_id; Google: identificador estável se disponível.';

-- Atualiza updated_at
CREATE OR REPLACE FUNCTION public.touch_user_subscriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_user_subscriptions_updated_at ON user_subscriptions;
CREATE TRIGGER trg_user_subscriptions_updated_at
  BEFORE UPDATE ON user_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_user_subscriptions_updated_at();

-- =====================================================
-- RLS
-- =====================================================
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;

-- Usuário autenticado: ler apenas as próprias linhas
DROP POLICY IF EXISTS "user_subscriptions_select_own" ON user_subscriptions;
CREATE POLICY "user_subscriptions_select_own"
  ON user_subscriptions
  FOR SELECT
  USING (user_id = auth.uid());

-- App pode inserir registro para si (ex.: após compra confirmada no dispositivo)
DROP POLICY IF EXISTS "user_subscriptions_insert_own" ON user_subscriptions;
CREATE POLICY "user_subscriptions_insert_own"
  ON user_subscriptions
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- App pode atualizar a própria linha (ex.: renovação / expiração sincronizada)
DROP POLICY IF EXISTS "user_subscriptions_update_own" ON user_subscriptions;
CREATE POLICY "user_subscriptions_update_own"
  ON user_subscriptions
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Webhooks / Edge Functions com service_role ignoram RLS e podem inserir/atualizar qualquer usuário

-- =====================================================
-- Exemplos (opcional — remover em produção)
-- =====================================================
-- INSERT INTO user_subscriptions (
--   user_id, product_id, billing_period, platform, status,
--   purchased_at, expires_at, store_original_transaction_id, auto_renew
-- ) VALUES (
--   auth.uid(),
--   'marcaai_mensal_app',
--   'monthly',
--   'ios',
--   'active',
--   NOW(),
--   NOW() + INTERVAL '1 month',
--   'apple_orig_xxx',
--   TRUE
-- );
