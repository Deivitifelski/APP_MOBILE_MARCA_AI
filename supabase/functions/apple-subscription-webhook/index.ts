/**
 * App Store Server Notifications V2 → Supabase (`user_subscriptions` + `users.plan_is_active`)
 *
 * Deploy: `supabase functions deploy apple-subscription-webhook` (legado; preferir `activate-subscription`)
 * URL:    https://<ref>.supabase.co/functions/v1/apple-subscription-webhook
 *
 * App Store Connect → Notificações do servidor → Versão 2 → URLs produção + sandbox.
 *
 * Corpo: { "signedPayload": "<JWS>" }
 * O app deve enviar appAccountToken = UUID do usuário Supabase na compra (StoreKit 2).
 *
 * Produção: implementar verifyJWS com certificados Apple (hoje só decodifica).
 *
 * @see https://developer.apple.com/documentation/appstoreservernotifications
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const supabase =
  supabaseUrl && serviceKey
    ? createClient(supabaseUrl, serviceKey, {
        auth: { persistSession: false, detectSessionInUrl: false },
      })
    : null;

const ALLOWED_PRODUCT_IDS = new Set([
  'marcaai_mensal_app',
  'marcaai_anual_app',
  'marcaai_mensal',
  'marcaai_anual',
]);

function decodeJWSPayload<T = Record<string, unknown>>(jws: string): T {
  const parts = jws.split('.');
  if (parts.length < 2) {
    throw new Error('JWS inválido');
  }
  const payload = parts[1];
  const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
  const pad = base64.length % 4;
  const padded = pad ? base64 + '='.repeat(4 - pad) : base64;
  const json = atob(padded);
  return JSON.parse(json) as T;
}

/** Produção: validar assinatura com certificados Apple. */
async function verifyJWS(_jws: string): Promise<boolean> {
  return true;
}

function mapSubscriptionStatus(notificationType: string, subtype: string | undefined): string {
  switch (notificationType) {
    case 'SUBSCRIBED':
    case 'DID_RENEW':
    case 'RENEWAL_EXTENDED':
    case 'OFFER_REDEEMED':
      return 'active';

    case 'DID_CHANGE_RENEWAL_PREF':
    case 'DID_CHANGE_RENEWAL_STATUS':
      return 'active';

    case 'EXPIRED':
    case 'GRACE_PERIOD_EXPIRED':
      return 'expired';

    case 'REFUND':
    case 'REVOKE':
      return 'revoked';

    case 'DID_FAIL_TO_RENEW':
      return subtype === 'GRACE_PERIOD' ? 'grace_period' : 'active';

    case 'PRICE_INCREASE':
      return 'active';

    default:
      return 'pending';
  }
}

/** Alinhado à RPC sync_user_subscription_from_client (SKU explícito, não só "annual" no nome). */
function billingPeriodFromProductId(productId: string): 'monthly' | 'annual' {
  const p = productId.trim();
  if (p === 'marcaai_anual_app' || p === 'marcaai_anual') return 'annual';
  if (p === 'marcaai_mensal_app' || p === 'marcaai_mensal') return 'monthly';
  const low = p.toLowerCase();
  if (low.includes('anual') || low.includes('annual') || low.includes('year')) return 'annual';
  if (low.includes('mensal') || low.includes('month')) return 'monthly';
  return 'monthly';
}

function msToIso(ms: number | undefined): string | null {
  if (ms == null || Number.isNaN(ms)) return null;
  return new Date(ms).toISOString();
}

type JsonRecord = Record<string, unknown>;

/** Preserva metadata do app (ex.: client_sync) e sobrepõe campos oficiais da Apple. */
function mergeAppleServerMetadata(prev: unknown, layer: JsonRecord): JsonRecord {
  const base =
    prev && typeof prev === 'object' && prev !== null && !Array.isArray(prev)
      ? { ...(prev as JsonRecord) }
      : {};
  return { ...base, ...layer };
}

async function syncUserPlanActive(
  userId: string,
  status: string,
  expiresAtIso: string | null,
): Promise<void> {
  if (!supabase) return;

  const now = Date.now();
  let planActive = false;

  if (status === 'revoked' || status === 'expired') {
    planActive = false;
  } else if (status === 'active' || status === 'grace_period') {
    planActive = true;
  } else if (expiresAtIso && new Date(expiresAtIso).getTime() > now) {
    planActive = true;
  }

  const { error } = await supabase.from('users').update({ plan_is_active: planActive }).eq('id', userId);

  if (error) {
    console.error('❌ Erro ao atualizar users.plan_is_active:', error.message);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204 });
  }

  if (req.method !== 'POST') {
    return new Response('method not allowed', { status: 405 });
  }

  if (!supabase) {
    console.error('❌ SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausente');
    return new Response('server misconfigured', { status: 500 });
  }

  try {
    const body = await req.json();

    const signedPayload = body?.signedPayload as string | undefined;
    if (!signedPayload || typeof signedPayload !== 'string') {
      console.warn('⚠️ Corpo sem signedPayload (V2). Se a Apple estiver em V1, altere para V2 no App Store Connect.');
      return new Response('ok', { status: 200 });
    }

    const outerOk = await verifyJWS(signedPayload);
    if (!outerOk) {
      return new Response('invalid signature', { status: 401 });
    }

    const outer = decodeJWSPayload<{
      notificationType?: string;
      subtype?: string;
      notificationUUID?: string;
      data?: {
        bundleId?: string;
        environment?: string;
        signedTransactionInfo?: string;
        signedRenewalInfo?: string;
      };
    }>(signedPayload);

    const notificationType = outer.notificationType ?? 'UNKNOWN';
    const subtype = outer.subtype;
    console.log('🍎 Apple ASN V2:', notificationType, subtype ?? '');

    const signedTransactionInfo = outer.data?.signedTransactionInfo;
    if (!signedTransactionInfo) {
      console.log('ℹ️ Sem signedTransactionInfo — ignorado');
      return new Response('ok', { status: 200 });
    }

    const txOk = await verifyJWS(signedTransactionInfo);
    if (!txOk) {
      return new Response('invalid transaction jws', { status: 401 });
    }

    const tx = decodeJWSPayload<{
      originalTransactionId?: string;
      transactionId?: string;
      productId?: string;
      purchaseDate?: number;
      expiresDate?: number;
      revocationDate?: number;
      appAccountToken?: string;
    }>(signedTransactionInfo);

    const originalTransactionId = tx.originalTransactionId;
    const transactionId = tx.transactionId;
    const productId = tx.productId;

    if (!originalTransactionId || !transactionId || !productId) {
      console.warn('⚠️ Transação sem campos obrigatórios');
      return new Response('ok', { status: 200 });
    }

    if (!ALLOWED_PRODUCT_IDS.has(productId.trim())) {
      console.warn('⚠️ product_id fora da lista Marca AI:', productId);
    }

    let userId: string | null = null;

    if (tx.appAccountToken) {
      const raw = tx.appAccountToken.trim();
      const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidRe.test(raw)) {
        userId = raw;
      } else {
        console.warn('⚠️ appAccountToken presente mas não é UUID válido');
      }
    }

    if (!userId) {
      const { data } = await supabase
        .from('user_subscriptions')
        .select('user_id')
        .eq('store_original_transaction_id', originalTransactionId)
        .maybeSingle();
      userId = data?.user_id ?? null;
    }

    if (!userId) {
      console.error('❌ user_id não encontrado — use appAccountToken = UUID Supabase na compra (iOS).');
      return new Response('ok', { status: 200 });
    }

    const status = mapSubscriptionStatus(notificationType, subtype);
    const purchasedAt = msToIso(tx.purchaseDate);
    const expiresAt = msToIso(tx.expiresDate);
    const cancelledAt = msToIso(tx.revocationDate);

    let autoRenew = true;
    const signedRenewal = outer.data?.signedRenewalInfo;
    if (signedRenewal) {
      try {
        const renOk = await verifyJWS(signedRenewal);
        if (renOk) {
          const ren = decodeJWSPayload<{ autoRenewStatus?: number }>(signedRenewal);
          if (ren.autoRenewStatus === 0) autoRenew = false;
        }
      } catch {
        /* ignora */
      }
    }

    const appleMetaLayer: JsonRecord = {
      source: 'apple_asn_v2',
      apple_store_confirmed: true,
      apple_confirmed_at_ms: Date.now(),
      notificationType,
      subtype: subtype ?? null,
      notificationUUID: outer.notificationUUID ?? null,
      environment: outer.data?.environment ?? null,
      transaction: tx as unknown as JsonRecord,
    };

    const rowPayload = (metadata: JsonRecord) => ({
      user_id: userId,
      product_id: productId,
      billing_period: billingPeriodFromProductId(productId),
      platform: 'ios' as const,
      status,
      purchased_at: purchasedAt,
      expires_at: expiresAt,
      cancelled_at: cancelledAt,
      store_original_transaction_id: originalTransactionId,
      store_latest_transaction_id: transactionId,
      auto_renew: autoRenew,
      metadata,
    });

    const { data: existingByTx } = await supabase
      .from('user_subscriptions')
      .select('id, metadata')
      .eq('user_id', userId)
      .eq('store_latest_transaction_id', transactionId)
      .maybeSingle();

    if (existingByTx) {
      const metadata = mergeAppleServerMetadata(existingByTx.metadata, appleMetaLayer);
      const { error } = await supabase
        .from('user_subscriptions')
        .update(rowPayload(metadata))
        .eq('id', existingByTx.id);
      if (error) {
        console.error('❌ Update (confirm por transactionId) user_subscriptions:', error.message);
        return new Response('db error', { status: 500 });
      }
      console.log('✅ Apple confirmou registro já criado pelo app (mesmo transactionId)');
      await syncUserPlanActive(userId, status, expiresAt);
      return new Response('ok', { status: 200 });
    }

    const { data: existingSub } = await supabase
      .from('user_subscriptions')
      .select('id, metadata')
      .eq('user_id', userId)
      .eq('store_original_transaction_id', originalTransactionId)
      .maybeSingle();

    if (existingSub) {
      const metadata = mergeAppleServerMetadata(existingSub.metadata, appleMetaLayer);
      const { error } = await supabase
        .from('user_subscriptions')
        .update(rowPayload(metadata))
        .eq('id', existingSub.id);
      if (error) {
        console.error('❌ Update user_subscriptions:', error.message);
        return new Response('db error', { status: 500 });
      }
      console.log('🔄 Assinatura atualizada (original_transaction_id)');
    } else {
      // Mesmo registro do app: original ainda NULL/divergente ou múltiplas linhas quebraram maybeSingle antes
      const { data: consolidateRow } = await supabase
        .from('user_subscriptions')
        .select('id, metadata')
        .eq('user_id', userId)
        .eq('platform', 'ios')
        .in('status', ['active', 'grace_period', 'pending'])
        .or('metadata->>source.is.null,metadata->>source.neq.manual_db')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (consolidateRow) {
        const metadata = mergeAppleServerMetadata(consolidateRow.metadata, appleMetaLayer);
        const { error } = await supabase
          .from('user_subscriptions')
          .update(rowPayload(metadata))
          .eq('id', consolidateRow.id);
        if (error) {
          console.error('❌ Update user_subscriptions (consolidado iOS):', error.message);
          return new Response('db error', { status: 500 });
        }
        console.log('🔄 Assinatura consolidada na linha iOS existente do usuário (evita duplicata)');
      } else {
        if (status === 'active' || status === 'grace_period') {
          await supabase
            .from('user_subscriptions')
            .update({ status: 'expired' })
            .eq('user_id', userId)
            .in('status', ['active', 'grace_period'])
            .or('metadata->>source.is.null,metadata->>source.neq.manual_db');
          const { data: manualOnly } = await supabase
            .from('user_subscriptions')
            .select('id')
            .eq('user_id', userId)
            .eq('metadata->>source', 'manual_db')
            .in('status', ['active', 'grace_period'])
            .maybeSingle();
          if (manualOnly) {
            await supabase
              .from('user_subscriptions')
              .update({ status: 'expired' })
              .eq('id', manualOnly.id);
          }
        }

        const metadata = mergeAppleServerMetadata({}, appleMetaLayer);
        const { error } = await supabase.from('user_subscriptions').insert(rowPayload(metadata));
        if (error) {
          console.error('❌ Insert user_subscriptions:', error.message);
          return new Response('db error', { status: 500 });
        }
        console.log('🆕 Assinatura criada');
      }
    }

    await syncUserPlanActive(userId, status, expiresAt);

    return new Response('ok', { status: 200 });
  } catch (err) {
    console.error('❌ Erro:', err);
    return new Response('error', { status: 500 });
  }
});
