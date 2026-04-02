import {
  getAvailablePurchases,
  initConnection,
  syncIOS,
  type Purchase,
} from 'expo-iap';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';

const PREMIUM_SKUS = ['marcaai_mensal_app', 'marcaai_anual_app'] as const;
const MONTHLY_SKU = 'marcaai_mensal_app';
const ANNUAL_SKU = 'marcaai_anual_app';

type SyncPayload = {
  source: 'after_purchase' | 'reconcile';
  platform: 'ios' | 'android';
  productId: string;
  transactionId?: string | null;
  originalTransactionId?: string | null;
  purchaseToken?: string | null;
  expiresAtMs?: number | null;
  purchasedAtMs?: number | null;
  autoRenew?: boolean | null;
};

function resolveActivePremiumPurchase(purchases: Purchase[]): Purchase | null {
  const premium = purchases.filter((p) => PREMIUM_SKUS.includes(p.productId as (typeof PREMIUM_SKUS)[number]));
  if (!premium.length) return null;

  const now = Date.now();
  const valid = premium.filter((p) => {
    const exp = 'expirationDateIOS' in p ? p.expirationDateIOS : undefined;
    if (exp == null || exp === undefined) return true;
    return exp > now;
  });
  const pool = valid.length > 0 ? valid : premium;

  const annual = pool.find((p) => p.productId === ANNUAL_SKU);
  if (annual) return annual;
  const monthly = pool.find((p) => p.productId === MONTHLY_SKU);
  return monthly ?? pool[0] ?? null;
}

function purchaseToPayload(purchase: Purchase, source: SyncPayload['source']): SyncPayload {
  const platform = Platform.OS === 'ios' ? 'ios' : 'android';
  if (platform === 'ios') {
    const p = purchase as Purchase & {
      originalTransactionIdentifierIOS?: string;
      expirationDateIOS?: number;
      originalTransactionDateIOS?: number;
    };
    return {
      source,
      platform: 'ios',
      productId: purchase.productId,
      transactionId: p.transactionId ?? null,
      originalTransactionId: p.originalTransactionIdentifierIOS ?? p.transactionId ?? null,
      purchaseToken: purchase.purchaseToken ?? null,
      expiresAtMs: p.expirationDateIOS ?? null,
      purchasedAtMs: p.originalTransactionDateIOS ?? purchase.transactionDate,
      autoRenew: purchase.isAutoRenewing,
    };
  }

  return {
    source,
    platform: 'android',
    productId: purchase.productId,
    transactionId: purchase.transactionId ?? null,
    originalTransactionId: purchase.purchaseToken ?? purchase.transactionId ?? null,
    purchaseToken: purchase.purchaseToken ?? null,
    expiresAtMs: null,
    purchasedAtMs: purchase.transactionDate,
    autoRenew: purchase.isAutoRenewing,
  };
}

async function rpcSync(payload: SyncPayload): Promise<void> {
  const expiresMs =
    payload.expiresAtMs != null && Number.isFinite(payload.expiresAtMs)
      ? Math.round(payload.expiresAtMs)
      : null;
  const purchasedMs =
    payload.purchasedAtMs != null && Number.isFinite(payload.purchasedAtMs)
      ? Math.round(payload.purchasedAtMs)
      : null;

  const { data, error } = await supabase.rpc('sync_user_subscription_from_client', {
    p_reconcile_clear: false,
    p_product_id: payload.productId,
    p_platform: payload.platform,
    p_transaction_id: payload.transactionId ?? null,
    p_original_transaction_id: payload.originalTransactionId ?? null,
    p_purchase_token: payload.purchaseToken ?? null,
    p_expires_at_ms: expiresMs,
    p_purchased_at_ms: purchasedMs,
    p_auto_renew: payload.autoRenew ?? true,
    p_source: payload.source,
  });

  if (error) {
    console.warn('[subscriptionSync] rpc error', error.message);
    return;
  }

  const row = data as { ok?: boolean; error?: string } | null;
  if (row && row.ok === false && row.error) {
    console.warn('[subscriptionSync] sync failed', row.error);
  }
}

/** Após compra confirmada na loja (listener). */
export async function syncSubscriptionAfterPurchase(purchase: Purchase): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user?.id) return;
  if (!PREMIUM_SKUS.includes(purchase.productId as (typeof PREMIUM_SKUS)[number])) return;

  const payload = purchaseToPayload(purchase, 'after_purchase');
  await rpcSync(payload);
}

/** Após restaurar compras: envia assinatura Premium ativa para o backend. */
export async function syncSubscriptionAfterRestore(): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user?.id) return;

  const okInit = await initConnection().catch(() => false);
  if (!okInit) return;

  if (Platform.OS === 'ios') {
    await syncIOS().catch(() => undefined);
  }

  const purchases = await getAvailablePurchases({ onlyIncludeActiveItemsIOS: true });
  const purchase = resolveActivePremiumPurchase(purchases);
  if (purchase) {
    await syncSubscriptionAfterPurchase(purchase);
  }
}
