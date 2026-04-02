/**
 * App Store Server Notifications V2 → Supabase
 *
 * URL da função (deploy): configure em App Store Connect → Server Notifications
 * Corpo real: { "signedPayload": "<JWS>" } — não vem notificationType na raiz.
 *
 * Recomendações:
 * - No app, use appAccountToken = auth user id (UUID) na compra StoreKit 2 para o webhook achar o usuário.
 * - Em produção: valide a assinatura do JWS com as raízes da Apple (veja documentação).
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

// ===============================
// Decode JWS payload (Base64URL) — sem verificação criptográfica
// ===============================
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

/** Produção: validar assinatura com certificados Apple (root + cadeia). */
async function verifyJWS(_jws: string): Promise<boolean> {
  // TODO: implementar verificação real (ex.: biblioteca oficial ou JWKS Apple)
  return true;
}

// ===============================
// Apple V2 → status da tabela user_subscriptions
// @see notificationType / subtype na documentação Apple
// ===============================
function mapSubscriptionStatus(notificationType: string, subtype: string | undefined): string {
  switch (notificationType) {
    case 'SUBSCRIBED':
    case 'DID_RENEW':
    case 'RENEWAL_EXTENDED':
    case 'OFFER_REDEEMED':
      return 'active';

    case 'DID_CHANGE_RENEWAL_PREF':
      return 'active';

    case 'DID_CHANGE_RENEWAL_STATUS':
      // Ainda tem acesso até expirar; só desliga auto_renew
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

function billingPeriodFromProductId(productId: string): 'monthly' | 'annual' {
  const p = productId.toLowerCase();
  if (p.includes('anual') || p.includes('annual') || p.includes('year')) return 'annual';
  if (p.includes('mensal') || p.includes('month')) return 'monthly';
  return 'monthly';
}

/** Apple envia datas em ms desde epoch (número). */
function msToIso(ms: number | undefined): string | null {
  if (ms == null || Number.isNaN(ms)) return null;
  return new Date(ms).toISOString();
}

async function syncUserPlanActive(
  userId: string,
  status: string,
  expiresAtIso: string | null,
): Promise<void> {
  if (!supabase) return;

  const now = Date.now();
  let planActive = false;

  if (status === 'revoked') {
    planActive = false;
  } else if (status === 'expired') {
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
  if (req.method !== 'POST') {
    return new Response('method not allowed', { status: 405 });
  }

  if (!supabase) {
    console.error('❌ SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausente');
    return new Response('server misconfigured', { status: 500 });
  }

  try {
    const body = await req.json();

    // ----- V2: payload assinado na raiz -----
    const signedPayload = body?.signedPayload as string | undefined;
    if (!signedPayload || typeof signedPayload !== 'string') {
      console.warn('⚠️ Corpo sem signedPayload (ignorado)');
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
      console.log('ℹ️ Sem signedTransactionInfo — nada a gravar em user_subscriptions');
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

    let userId: string | null = null;

    if (tx.appAccountToken) {
      userId = tx.appAccountToken.trim();
    } else {
      const { data } = await supabase
        .from('user_subscriptions')
        .select('user_id')
        .eq('store_original_transaction_id', originalTransactionId)
        .maybeSingle();
      userId = data?.user_id ?? null;
    }

    if (!userId) {
      console.error('❌ user_id não encontrado — defina appAccountToken = UUID do usuário na compra');
      return new Response('ok', { status: 200 });
    }

    const status = mapSubscriptionStatus(notificationType, subtype);
    const purchasedAt = msToIso(tx.purchaseDate);
    const expiresAt = msToIso(tx.expiresDate);
    const cancelledAt = msToIso(tx.revocationDate);

    // Idempotência: mesmo transactionId já processado
    const { data: existingTx } = await supabase
      .from('user_subscriptions')
      .select('id')
      .eq('store_latest_transaction_id', transactionId)
      .maybeSingle();

    if (existingTx) {
      console.log('⚠️ Evento já processado (transactionId):', transactionId);
      return new Response('ok', { status: 200 });
    }

    const { data: existingSub } = await supabase
      .from('user_subscriptions')
      .select('id')
      .eq('store_original_transaction_id', originalTransactionId)
      .maybeSingle();

    const row = {
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
      metadata: {
        notificationType,
        subtype: subtype ?? null,
        notificationUUID: outer.notificationUUID ?? null,
        transaction: tx,
      },
    };

    if (existingSub) {
      const { error } = await supabase.from('user_subscriptions').update(row).eq('id', existingSub.id);
      if (error) {
        console.error('❌ Update user_subscriptions:', error.message);
        return new Response('db error', { status: 500 });
      }
      console.log('🔄 Assinatura atualizada');
    } else {
      // Evita violar uniq_user_subscriptions_one_active (uma linha active/grace por user_id)
      if (status === 'active' || status === 'grace_period') {
        await supabase
          .from('user_subscriptions')
          .update({ status: 'expired' })
          .eq('user_id', userId)
          .in('status', ['active', 'grace_period']);
      }

      const { error } = await supabase.from('user_subscriptions').insert(row);
      if (error) {
        console.error('❌ Insert user_subscriptions:', error.message);
        return new Response('db error', { status: 500 });
      }
      console.log('🆕 Assinatura criada');
    }

    await syncUserPlanActive(userId, status, expiresAt);

    return new Response('ok', { status: 200 });
  } catch (err) {
    console.error('❌ Erro:', err);
    return new Response('error', { status: 500 });
  }
});
