/**
 * Google Play Real-time developer notifications (RTDN) → Pub/Sub push → Supabase
 *
 * Atualiza a mesma tabela `user_subscriptions` e `users.plan_is_active` que a Apple (`activate-subscription`).
 *
 * ## Configuração Play Console
 * 1. Criar tópico Cloud Pub/Sub e vincular em Monetização → Configuração RTDN.
 * 2. Criar assinatura push apontando para:
 *    `https://<ref>.supabase.co/functions/v1/google-play-rtdn`
 * 3. Corpo: Pub/Sub envia `{ "message": { "data": "<base64 JSON DeveloperNotification>" } }`.
 *
 * ## Variáveis (Secrets) no Supabase
 * - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (padrão)
 * - `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` — JSON da service account com permissão **Ver dados financeiros** na Play Console
 * - `GOOGLE_PLAY_PACKAGE_NAME` — ex.: `com.marcaaipro.app` (opcional se bater com o app publicado)
 * - `GOOGLE_PUBSUB_AUDIENCE` — audience configurado na assinatura push OIDC do Pub/Sub (obrigatório)
 * - `GOOGLE_PUBSUB_SERVICE_ACCOUNT_EMAIL` — e-mail da service account usada no OIDC push (opcional, recomendado)
 *
 * ## App (recomendado)
 * Passe o UUID do usuário Supabase como conta ofuscada na compra (Billing obfuscated account id),
 * para o RTDN conseguir vincular mesmo sem linha prévia no banco. Caso contrário, a função tenta
 * localizar por `purchaseToken` já salvo pelo app em `sync_user_subscription_from_client`.
 *
 * Deploy: `supabase functions deploy google-play-rtdn --no-verify-jwt`
 *
 * @see https://developer.android.com/google/play/billing/rtdn-reference
 * @see https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.subscriptionsv2/get
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { GoogleAuth } from 'npm:google-auth-library@9.0.0';
import { createRemoteJWKSet, jwtVerify } from 'npm:jose@5.9.6';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const PLAY_SA_JSON = Deno.env.get('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON') ?? '';
const PACKAGE_NAME =
  Deno.env.get('GOOGLE_PLAY_PACKAGE_NAME')?.trim() || 'com.marcaaipro.app';
const PUBSUB_AUDIENCE = Deno.env.get('GOOGLE_PUBSUB_AUDIENCE')?.trim() || '';
const PUBSUB_SERVICE_ACCOUNT_EMAIL =
  Deno.env.get('GOOGLE_PUBSUB_SERVICE_ACCOUNT_EMAIL')?.trim() || '';

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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GOOGLE_OIDC_JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

function maskToken(value: string): string {
  if (!value) return '';
  if (value.length <= 10) return `${value.slice(0, 3)}...`;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

async function verifyPubSubOidcToken(req: Request): Promise<{
  ok: boolean;
  reason?: string;
  email?: string | null;
}> {
  if (!PUBSUB_AUDIENCE) {
    return {
      ok: false,
      reason:
        'GOOGLE_PUBSUB_AUDIENCE não configurado. Defina o audience do push OIDC para validar origem do Pub/Sub.',
    };
  }

  const authHeader = req.headers.get('authorization') ?? req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { ok: false, reason: 'Authorization Bearer ausente' };
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) {
    return { ok: false, reason: 'Bearer token vazio' };
  }

  try {
    const { payload } = await jwtVerify(token, GOOGLE_OIDC_JWKS, {
      issuer: ['https://accounts.google.com', 'accounts.google.com'],
      audience: PUBSUB_AUDIENCE,
    });

    const email = typeof payload.email === 'string' ? payload.email : null;
    const emailVerified = payload.email_verified === true;

    if (PUBSUB_SERVICE_ACCOUNT_EMAIL) {
      if (!email || email.toLowerCase() !== PUBSUB_SERVICE_ACCOUNT_EMAIL.toLowerCase()) {
        return {
          ok: false,
          reason: `email do token diferente do esperado (${PUBSUB_SERVICE_ACCOUNT_EMAIL})`,
          email,
        };
      }
    }

    if (email && !emailVerified) {
      return { ok: false, reason: 'email do token não verificado', email };
    }

    return { ok: true, email };
  } catch (e) {
    return {
      ok: false,
      reason: `falha na validação JWT Pub/Sub: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

type JsonRecord = Record<string, unknown>;

function billingPeriodFromProductId(productId: string): 'monthly' | 'annual' {
  const p = productId.trim();
  if (p === 'marcaai_anual_app' || p === 'marcaai_anual') return 'annual';
  if (p === 'marcaai_mensal_app' || p === 'marcaai_mensal') return 'monthly';
  const low = p.toLowerCase();
  if (low.includes('anual') || low.includes('annual') || low.includes('year')) return 'annual';
  if (low.includes('mensal') || low.includes('month')) return 'monthly';
  return 'monthly';
}

function mergeGoogleMetadata(prev: unknown, layer: JsonRecord): JsonRecord {
  const base =
    prev && typeof prev === 'object' && prev !== null && !Array.isArray(prev)
      ? { ...(prev as JsonRecord) }
      : {};
  return { ...base, ...layer };
}

type SubRow = { id: string; metadata: unknown; user_id?: string };

function mapGoogleState(
  subscriptionState: string | undefined,
  notificationType: number | undefined,
): string {
  if (notificationType === 12) return 'revoked';
  if (notificationType === 13) return 'expired';

  switch (subscriptionState) {
    case 'SUBSCRIPTION_STATE_ACTIVE':
      return 'active';
    case 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD':
      return 'grace_period';
    case 'SUBSCRIPTION_STATE_ON_HOLD':
      return 'grace_period';
    case 'SUBSCRIPTION_STATE_EXPIRED':
      return 'expired';
    case 'SUBSCRIPTION_STATE_CANCELED':
      return 'cancelled';
    case 'SUBSCRIPTION_STATE_PENDING':
      return 'pending';
    case 'SUBSCRIPTION_STATE_PENDING_PURCHASE_CANCELED':
      return 'expired';
    case 'SUBSCRIPTION_STATE_PAUSED':
      return 'active';
    default:
      if (notificationType === 3) return 'cancelled';
      if (notificationType === 6) return 'grace_period';
      if (notificationType === 5) return 'grace_period';
      return 'pending';
  }
}

async function syncUserPlanActive(
  userId: string,
  status: string,
  expiresAtIso: string | null,
): Promise<void> {
  if (!supabase) return;

  let planActive = false;
  if (status === 'revoked' || status === 'expired') {
    planActive = false;
  } else if (status === 'active' || status === 'grace_period') {
    planActive = true;
  } else if (status === 'cancelled' && expiresAtIso && new Date(expiresAtIso).getTime() > Date.now()) {
    planActive = true;
  } else if (status === 'pending' && expiresAtIso && new Date(expiresAtIso).getTime() > Date.now()) {
    planActive = true;
  }

  const { error } = await supabase.from('users').update({ plan_is_active: planActive }).eq('id', userId);
  if (error) console.error('❌ users.plan_is_active:', error.message);
}

async function expireOtherAndroidStoreDuplicates(userId: string, keepId: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase
    .from('user_subscriptions')
    .update({ status: 'expired' })
    .eq('user_id', userId)
    .eq('platform', 'android')
    .eq('status', 'pending')
    .neq('id', keepId)
    .or('metadata->>source.is.null,metadata->>source.neq.manual_db');
  if (error) console.warn('expireOtherAndroidStoreDuplicates:', error.message);
}

async function selectRowByLatestTx(userId: string, latestTx: string): Promise<SubRow | null> {
  const { data, error } = await supabase!
    .from('user_subscriptions')
    .select('id, metadata, user_id')
    .eq('user_id', userId)
    .eq('store_latest_transaction_id', latestTx)
    .order('updated_at', { ascending: false })
    .limit(1);
  if (error) {
    console.warn('selectRowByLatestTx:', error.message);
    return null;
  }
  return (data?.[0] as SubRow | undefined) ?? null;
}

async function selectRowByOriginal(userId: string, original: string): Promise<SubRow | null> {
  const { data, error } = await supabase!
    .from('user_subscriptions')
    .select('id, metadata, user_id')
    .eq('user_id', userId)
    .eq('store_original_transaction_id', original)
    .order('updated_at', { ascending: false })
    .limit(1);
  if (error) {
    console.warn('selectRowByOriginal:', error.message);
    return null;
  }
  return (data?.[0] as SubRow | undefined) ?? null;
}

async function findUserIdByPurchaseToken(
  purchaseToken: string,
): Promise<{ userId: string; rowId: string } | null> {
  const { data: a } = await supabase!
    .from('user_subscriptions')
    .select('user_id, id')
    .eq('store_original_transaction_id', purchaseToken)
    .order('updated_at', { ascending: false })
    .limit(1);
  if (a?.[0]) return { userId: a[0].user_id as string, rowId: a[0].id as string };

  const gplayTx = `gplay:${purchaseToken.slice(0, 120)}`;
  const { data: b } = await supabase!
    .from('user_subscriptions')
    .select('user_id, id')
    .eq('store_latest_transaction_id', gplayTx)
    .order('updated_at', { ascending: false })
    .limit(1);
  if (b?.[0]) return { userId: b[0].user_id as string, rowId: b[0].id as string };

  return null;
}

type SubscriptionsV2Response = {
  subscriptionState?: string;
  latestOrderId?: string;
  lineItems?: {
    productId?: string;
    expiryTime?: string;
    offerDetails?: unknown;
  }[];
  externalAccountIdentifiers?: {
    obfuscatedExternalAccountId?: string;
    externalAccountId?: string;
  };
  startTime?: string;
};

async function fetchSubscriptionV2(
  purchaseToken: string,
  packageName: string,
): Promise<SubscriptionsV2Response | null> {
  if (!PLAY_SA_JSON) {
    console.error('❌ GOOGLE_PLAY_SERVICE_ACCOUNT_JSON ausente');
    return null;
  }
  let credentials: Record<string, unknown>;
  try {
    credentials = JSON.parse(PLAY_SA_JSON);
  } catch {
    console.error('❌ GOOGLE_PLAY_SERVICE_ACCOUNT_JSON inválido');
    return null;
  }

  const auth = new GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/androidpublisher'],
  });
  const client = await auth.getClient();
  const access = await client.getAccessToken();
  const at = typeof access === 'string' ? access : access?.token;
  if (!at) {
    console.error('❌ Falha ao obter access token Google');
    return null;
  }

  const url =
    `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/` +
    `${encodeURIComponent(packageName)}/purchases/subscriptionsv2/tokens/` +
    `${encodeURIComponent(purchaseToken)}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${at}` },
  });

  if (!res.ok) {
    const text = await res.text();
    console.error('❌ Android Publisher API', res.status, text.slice(0, 500));
    return null;
  }

  return (await res.json()) as SubscriptionsV2Response;
}

function parsePubSubBody(body: unknown): Record<string, unknown> | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  const msg = b.message as Record<string, unknown> | undefined;
  const dataB64 = msg?.data;
  if (typeof dataB64 !== 'string') {
    return b;
  }
  try {
    const jsonStr = atob(dataB64.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(jsonStr) as Record<string, unknown>;
  } catch (e) {
    console.error('❌ Falha ao decodificar Pub/Sub message.data', e);
    return null;
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204 });
  }

  if (req.method !== 'POST') {
    return new Response('method not allowed', { status: 405 });
  }

  if (!supabase) {
    console.error('❌ Supabase não configurado');
    return new Response('server misconfigured', { status: 500 });
  }

  try {
    const reqId = crypto.randomUUID().slice(0, 8);
    const authCheck = await verifyPubSubOidcToken(req);
    if (!authCheck.ok) {
      console.error(`❌ [${reqId}] RTDN rejeitado:`, authCheck.reason);
      return new Response('unauthorized', { status: 401 });
    }
    console.log(
      `🔐 [${reqId}] RTDN autenticado via OIDC`,
      authCheck.email ? `(${authCheck.email})` : '',
    );

    const rawBody = await req.json();
    const notification = parsePubSubBody(rawBody);
    if (!notification) {
      console.error(`❌ [${reqId}] corpo inválido`);
      return new Response('invalid body', { status: 400 });
    }

    if (notification.testNotification) {
      console.log(`ℹ️ [${reqId}] RTDN test notification — ok`);
      return new Response('ok', { status: 200 });
    }

    const pkg = notification.packageName as string | undefined;
    if (pkg && pkg !== PACKAGE_NAME) {
      console.warn('⚠️ packageName inesperado:', pkg, 'esperado', PACKAGE_NAME);
    }

    const subNotif = notification.subscriptionNotification as
      | {
          subscriptionId?: string;
          purchaseToken?: string;
          notificationType?: number;
        }
      | undefined;

    if (!subNotif?.purchaseToken || !subNotif.subscriptionId) {
      console.log('ℹ️ Sem subscriptionNotification — ignorado');
      return new Response('ok', { status: 200 });
    }

    const purchaseToken = subNotif.purchaseToken;
    const subscriptionId = subNotif.subscriptionId;
    const notificationType = subNotif.notificationType;
    console.log(
      `📩 [${reqId}] RTDN recebido`,
      JSON.stringify({
        packageName: pkg || PACKAGE_NAME,
        subscriptionId,
        notificationType,
        purchaseToken: maskToken(purchaseToken),
      }),
    );

    if (!ALLOWED_PRODUCT_IDS.has(subscriptionId.trim())) {
      console.warn('⚠️ subscriptionId fora da lista Marca AI:', subscriptionId);
    }

    const packageName = pkg || PACKAGE_NAME;
    const v2 = await fetchSubscriptionV2(purchaseToken, packageName);
    if (!v2) {
      return new Response('play api error', { status: 500 });
    }

    const line = v2.lineItems?.[0];
    const productId = line?.productId || subscriptionId;
    const expiryIso = line?.expiryTime
      ? new Date(line.expiryTime).toISOString()
      : null;
    const startIso = v2.startTime ? new Date(v2.startTime).toISOString() : null;

    const subscriptionState = v2.subscriptionState;
    let status = mapGoogleState(subscriptionState, notificationType);

    if (
      status === 'cancelled' &&
      expiryIso &&
      new Date(expiryIso).getTime() > Date.now() &&
      (notificationType === 2 || notificationType === 4 || notificationType === 1)
    ) {
      status = 'active';
    }

    const obfuscated = v2.externalAccountIdentifiers?.obfuscatedExternalAccountId?.trim();
    let userId: string | null = null;
    let userResolveSource: 'obfuscated_account_id' | 'purchase_token_lookup' | 'none' = 'none';
    if (obfuscated && UUID_RE.test(obfuscated)) {
      userId = obfuscated;
      userResolveSource = 'obfuscated_account_id';
    }

    if (!userId) {
      const found = await findUserIdByPurchaseToken(purchaseToken);
      userId = found?.userId ?? null;
      if (userId) userResolveSource = 'purchase_token_lookup';
    }

    if (!userId) {
      console.error(
        `❌ [${reqId}] user_id não encontrado — defina obfuscated account id = UUID Supabase na compra Android ou garanta sync do app antes do RTDN.`,
      );
      return new Response('ok', { status: 200 });
    }
    console.log(
      `👤 [${reqId}] user_id resolvido`,
      JSON.stringify({ userId, source: userResolveSource }),
    );

    const latestOrderId = v2.latestOrderId?.trim();
    const storeLatest = latestOrderId || `gplay:${purchaseToken.slice(0, 120)}`;
    const storeOriginal = purchaseToken;

    const autoRenew =
      notificationType !== 3 &&
      notificationType !== 12 &&
      notificationType !== 13 &&
      subscriptionState !== 'SUBSCRIPTION_STATE_CANCELED' &&
      subscriptionState !== 'SUBSCRIPTION_STATE_EXPIRED';

    const googleMeta: JsonRecord = {
      source: 'google_rtdn',
      google_play_confirmed: true,
      google_confirmed_at_ms: Date.now(),
      notificationType: notificationType ?? null,
      subscriptionState: subscriptionState ?? null,
      packageName,
      subscriptionId,
      subscriptionsV2: v2 as unknown as JsonRecord,
    };

    const rowPayload = (metadata: JsonRecord) => ({
      user_id: userId,
      product_id: productId,
      billing_period: billingPeriodFromProductId(productId),
      platform: 'android' as const,
      status,
      purchased_at: startIso,
      expires_at: expiryIso,
      cancelled_at: status === 'revoked' ? new Date().toISOString() : null,
      store_original_transaction_id: storeOriginal,
      store_latest_transaction_id: storeLatest,
      auto_renew: autoRenew,
      metadata,
    });

    const existingByTx = await selectRowByLatestTx(userId, storeLatest);

    if (existingByTx) {
      const metadata = mergeGoogleMetadata(existingByTx.metadata, googleMeta);
      const { error } = await supabase
        .from('user_subscriptions')
        .update(rowPayload(metadata))
        .eq('id', existingByTx.id);
      if (error) {
        console.error('❌ Update user_subscriptions (latest tx):', error.message);
        return new Response('db error', { status: 500 });
      }
      await expireOtherAndroidStoreDuplicates(userId, existingByTx.id);
      await syncUserPlanActive(userId, status, expiryIso);
      console.log(
        `✅ [${reqId}] Google RTDN atualizado (store_latest_transaction_id)`,
        JSON.stringify({ userId, status, productId, expiresAt: expiryIso }),
      );
      return new Response('ok', { status: 200 });
    }

    const existingOrig = await selectRowByOriginal(userId, storeOriginal);

    if (existingOrig) {
      const metadata = mergeGoogleMetadata(existingOrig.metadata, googleMeta);
      const { error } = await supabase
        .from('user_subscriptions')
        .update(rowPayload(metadata))
        .eq('id', existingOrig.id);
      if (error) {
        console.error('❌ Update user_subscriptions (original token):', error.message);
        return new Response('db error', { status: 500 });
      }
      await expireOtherAndroidStoreDuplicates(userId, existingOrig.id);
      await syncUserPlanActive(userId, status, expiryIso);
      console.log(
        `✅ [${reqId}] Google RTDN atualizado (purchaseToken)`,
        JSON.stringify({ userId, status, productId, expiresAt: expiryIso }),
      );
      return new Response('ok', { status: 200 });
    }

    const { data: consolidateRows } = await supabase
      .from('user_subscriptions')
      .select('id, metadata')
      .eq('user_id', userId)
      .eq('platform', 'android')
      .in('status', ['active', 'grace_period', 'pending'])
      .or('metadata->>source.is.null,metadata->>source.neq.manual_db')
      .order('updated_at', { ascending: false })
      .limit(1);

    const consolidateRow = consolidateRows?.[0] as SubRow | undefined;

    if (consolidateRow) {
      const metadata = mergeGoogleMetadata(consolidateRow.metadata, googleMeta);
      const { error } = await supabase
        .from('user_subscriptions')
        .update(rowPayload(metadata))
        .eq('id', consolidateRow.id);
      if (error) {
        console.error('❌ Update consolidado Android:', error.message);
        return new Response('db error', { status: 500 });
      }
      await expireOtherAndroidStoreDuplicates(userId, consolidateRow.id);
      await syncUserPlanActive(userId, status, expiryIso);
      console.log(
        `✅ [${reqId}] Google RTDN consolidado em linha Android existente`,
        JSON.stringify({ userId, status, productId, expiresAt: expiryIso }),
      );
      return new Response('ok', { status: 200 });
    }

    if (status === 'active' || status === 'grace_period') {
      await supabase
        .from('user_subscriptions')
        .update({ status: 'expired' })
        .eq('user_id', userId)
        .in('status', ['active', 'grace_period', 'pending'])
        .or('metadata->>source.is.null,metadata->>source.neq.manual_db');

      const { data: manualOnly } = await supabase
        .from('user_subscriptions')
        .select('id')
        .eq('user_id', userId)
        .eq('metadata->>source', 'manual_db')
        .in('status', ['active', 'grace_period'])
        .maybeSingle();

      if (manualOnly) {
        await supabase.from('user_subscriptions').update({ status: 'expired' }).eq('id', manualOnly.id);
      }
    }

    const metadata = mergeGoogleMetadata({}, googleMeta);
    const { data: insertedRows, error: insErr } = await supabase
      .from('user_subscriptions')
      .insert(rowPayload(metadata))
      .select('id');

    if (insErr) {
      console.error('❌ Insert user_subscriptions:', insErr.message);
      return new Response('db error', { status: 500 });
    }

    const insertedId = insertedRows?.[0]?.id;
    if (insertedId) await expireOtherAndroidStoreDuplicates(userId, insertedId);

    await syncUserPlanActive(userId, status, expiryIso);
    console.log(
      `🆕 [${reqId}] Google RTDN criou linha user_subscriptions`,
      JSON.stringify({ userId, status, productId, expiresAt: expiryIso }),
    );
    return new Response('ok', { status: 200 });
  } catch (err) {
    console.error('❌ google-play-rtdn:', err);
    return new Response('error', { status: 500 });
  }
});
