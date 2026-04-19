/**
 * App Store Server Notifications V2 → Supabase (`user_subscriptions` + `users.plan_is_active`)
 *
 * Fluxo anti-duplicata: UPDATE por transactionId → por originalTransactionId → consolida pending do app; INSERT só se não houver linha compatível.
 *
 * Deploy: `supabase functions deploy activate-subscription`
 * URL:    https://<ref>.supabase.co/functions/v1/activate-subscription
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
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const supabase =
  supabaseUrl && serviceKey
    ? createClient(supabaseUrl, serviceKey, {
        auth: { persistSession: false, detectSessionInUrl: false },
      })
    : null;

const ALLOWED_PRODUCT_IDS = new Set([
  "marcaai_mensal_app",
  "marcaai_anual_app",
  "marcaai_mensal",
  "marcaai_anual",
]);

function decodeJWSPayload<T = Record<string, unknown>>(jws: string): T {
  const parts = jws.split(".");
  if (parts.length < 2) {
    throw new Error("JWS inválido");
  }
  const payload = parts[1];
  const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
  const pad = base64.length % 4;
  const padded = pad ? base64 + "=".repeat(4 - pad) : base64;
  const json = atob(padded);
  return JSON.parse(json) as T;
}

/** Produção: validar assinatura com certificados Apple. */
async function verifyJWS(_jws: string): Promise<boolean> {
  return true;
}

function mapSubscriptionStatus(
  notificationType: string,
  subtype: string | undefined,
): string {
  switch (notificationType) {
    case "SUBSCRIBED":
    case "DID_RENEW":
    case "RENEWAL_EXTENDED":
    case "OFFER_REDEEMED":
      return "active";

    case "DID_CHANGE_RENEWAL_PREF":
    case "DID_CHANGE_RENEWAL_STATUS":
      return "active";

    case "EXPIRED":
    case "GRACE_PERIOD_EXPIRED":
      return "expired";

    case "REFUND":
    case "REVOKE":
      return "revoked";

    case "DID_FAIL_TO_RENEW":
      return subtype === "GRACE_PERIOD" ? "grace_period" : "active";

    case "PRICE_INCREASE":
      return "active";

    default:
      return "pending";
  }
}

/** Alinhado à RPC sync_user_subscription_from_client (SKU explícito, não só "annual" no nome). */
function billingPeriodFromProductId(productId: string): "monthly" | "annual" {
  const p = productId.trim();
  if (p === "marcaai_anual_app" || p === "marcaai_anual") return "annual";
  if (p === "marcaai_mensal_app" || p === "marcaai_mensal") return "monthly";
  const low = p.toLowerCase();
  if (low.includes("anual") || low.includes("annual") || low.includes("year"))
    return "annual";
  if (low.includes("mensal") || low.includes("month")) return "monthly";
  return "monthly";
}

function msToIso(ms: number | undefined): string | null {
  if (ms == null || Number.isNaN(ms)) return null;
  return new Date(ms).toISOString();
}

type JsonRecord = Record<string, unknown>;

/** Preserva metadata do app (ex.: client_sync) e sobrepõe campos oficiais da Apple. */
function mergeAppleServerMetadata(
  prev: unknown,
  layer: JsonRecord,
): JsonRecord {
  const base =
    prev && typeof prev === "object" && prev !== null && !Array.isArray(prev)
      ? { ...(prev as JsonRecord) }
      : {};
  return { ...base, ...layer };
}

type SubRow = { id: string; metadata: unknown };

function isManualDbMetadata(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return false;
  }
  return (metadata as JsonRecord).source === "manual_db";
}

/**
 * Linha iOS não manual a atualizar (pending/active/grace ou, se só houver, a mais recente inclusive expired).
 * Evita `.or` em JSON no PostgREST, que costuma falhar e forçar INSERT duplicado.
 */
async function selectIosRowToMergeAppleWebhook(
  userId: string,
): Promise<SubRow | null> {
  const { data, error } = await supabase!
    .from("user_subscriptions")
    .select("id, metadata, status")
    .eq("user_id", userId)
    .eq("platform", "ios")
    .order("updated_at", { ascending: false })
    .limit(40);
  if (error) {
    console.warn("selectIosRowToMergeAppleWebhook:", error.message);
    return null;
  }
  const rows = (data ?? []) as {
    id: string;
    metadata: unknown;
    status: string;
  }[];
  const nonManual = rows.filter((r) => !isManualDbMetadata(r.metadata));
  if (nonManual.length === 0) return null;
  const preferred = nonManual.find((r) =>
    ["pending", "active", "grace_period"].includes(r.status),
  );
  const chosen = preferred ?? nonManual[0];
  return { id: chosen.id, metadata: chosen.metadata };
}

async function selectUserIdByOriginalTransactionId(
  originalTransactionId: string,
): Promise<string | null> {
  const { data, error } = await supabase!
    .from("user_subscriptions")
    .select("user_id")
    .eq("store_original_transaction_id", originalTransactionId)
    .order("updated_at", { ascending: false })
    .limit(1);
  if (error) {
    console.warn("selectUserIdByOriginalTransactionId:", error.message);
    return null;
  }
  return (data?.[0] as { user_id?: string } | undefined)?.user_id ?? null;
}

/**
 * `.maybeSingle()` retorna erro (PGRST116) se houver 2+ linhas — comum com pending duplicado do app + webhook.
 * Sempre usa limit(1) ordenado pela linha mais recente.
 */
async function selectRowByLatestTransactionId(
  userId: string,
  transactionId: string,
): Promise<SubRow | null> {
  const { data, error } = await supabase!
    .from("user_subscriptions")
    .select("id, metadata")
    .eq("user_id", userId)
    .eq("store_latest_transaction_id", transactionId)
    .order("updated_at", { ascending: false })
    .limit(1);
  if (error) {
    console.warn("selectRowByLatestTransactionId:", error.message);
    return null;
  }
  return (data?.[0] as SubRow | undefined) ?? null;
}

async function selectRowByOriginalTransactionId(
  userId: string,
  originalTransactionId: string,
): Promise<SubRow | null> {
  const { data, error } = await supabase!
    .from("user_subscriptions")
    .select("id, metadata")
    .eq("user_id", userId)
    .eq("store_original_transaction_id", originalTransactionId)
    .order("updated_at", { ascending: false })
    .limit(1);
  if (error) {
    console.warn("selectRowByOriginalTransactionId:", error.message);
    return null;
  }
  return (data?.[0] as SubRow | undefined) ?? null;
}

/** Expira outros `pending` iOS não manual (sem `.or` em JSON no PostgREST). */
async function expireOtherIosPendingDuplicates(
  userId: string,
  keepId: string,
): Promise<void> {
  const { data, error } = await supabase!
    .from("user_subscriptions")
    .select("id, metadata")
    .eq("user_id", userId)
    .eq("platform", "ios")
    .eq("status", "pending")
    .neq("id", keepId);
  if (error) {
    console.warn("expireOtherIosPendingDuplicates:", error.message);
    return;
  }
  const pendingRows = (data ?? []) as { id: string; metadata: unknown }[];
  for (const row of pendingRows) {
    if (isManualDbMetadata(row.metadata)) continue;
    const { error: upErr } = await supabase!
      .from("user_subscriptions")
      .update({ status: "expired" })
      .eq("id", row.id);
    if (upErr) {
      console.warn("expireOtherIosPendingDuplicates update:", upErr.message);
    }
  }
}

/** Antes do INSERT: expira linhas iOS ativas/pending não manuais + cortesia manual ativa. */
async function expireIosNonManualForAppleReplace(userId: string): Promise<void> {
  const { data, error } = await supabase!
    .from("user_subscriptions")
    .select("id, metadata")
    .eq("user_id", userId)
    .eq("platform", "ios")
    .in("status", ["active", "grace_period", "pending"]);
  if (error) {
    console.warn("expireIosNonManualForAppleReplace:", error.message);
    return;
  }
  const rows = (data ?? []) as { id: string; metadata: unknown }[];
  for (const row of rows) {
    if (isManualDbMetadata(row.metadata)) continue;
    await supabase!
      .from("user_subscriptions")
      .update({ status: "expired" })
      .eq("id", row.id);
  }
  const { data: manualRows } = await supabase!
    .from("user_subscriptions")
    .select("id")
    .eq("user_id", userId)
    .eq("platform", "ios")
    .eq("metadata->>source", "manual_db")
    .in("status", ["active", "grace_period"])
    .order("updated_at", { ascending: false })
    .limit(1);
  const manualId = manualRows?.[0]?.id as string | undefined;
  if (manualId) {
    await supabase!
      .from("user_subscriptions")
      .update({ status: "expired" })
      .eq("id", manualId);
  }
}

async function syncUserPlanActive(
  userId: string,
  status: string,
  expiresAtIso: string | null,
): Promise<void> {
  if (!supabase) return;

  let planActive = false;

  if (status === "revoked" || status === "expired") {
    planActive = false;
  } else if (status === "active" || status === "grace_period") {
    planActive = true;
  } else if (
    status === "pending" &&
    expiresAtIso &&
    new Date(expiresAtIso).getTime() > Date.now()
  ) {
    planActive = true;
  }

  const { error } = await supabase
    .from("users")
    .update({ plan_is_active: planActive })
    .eq("id", userId);

  if (error) {
    console.error("❌ Erro ao atualizar users.plan_is_active:", error.message);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  if (req.method !== "POST") {
    return new Response("method not allowed", { status: 405 });
  }

  if (!supabase) {
    console.error("❌ SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausente");
    return new Response("server misconfigured", { status: 500 });
  }

  try {
    const body = await req.json();

    const signedPayload = body?.signedPayload as string | undefined;
    if (!signedPayload || typeof signedPayload !== "string") {
      console.warn(
        "⚠️ Corpo sem signedPayload (V2). Se a Apple estiver em V1, altere para V2 no App Store Connect.",
      );
      return new Response("ok", { status: 200 });
    }

    const outerOk = await verifyJWS(signedPayload);
    if (!outerOk) {
      return new Response("invalid signature", { status: 401 });
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

    const notificationType = outer.notificationType ?? "UNKNOWN";
    const subtype = outer.subtype;
    console.log("🍎 Apple ASN V2:", notificationType, subtype ?? "");

    const signedTransactionInfo = outer.data?.signedTransactionInfo;
    if (!signedTransactionInfo) {
      console.log("ℹ️ Sem signedTransactionInfo — ignorado");
      return new Response("ok", { status: 200 });
    }

    const txOk = await verifyJWS(signedTransactionInfo);
    if (!txOk) {
      return new Response("invalid transaction jws", { status: 401 });
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
      console.warn("⚠️ Transação sem campos obrigatórios");
      return new Response("ok", { status: 200 });
    }

    if (!ALLOWED_PRODUCT_IDS.has(productId.trim())) {
      console.warn(
        "⚠️ product_id não suportado — ignorado (sem alterar DB):",
        productId,
      );
      return new Response("ok", { status: 200 });
    }

    let userId: string | null = null;

    if (tx.appAccountToken) {
      const raw = tx.appAccountToken.trim();
      const uuidRe =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidRe.test(raw)) {
        userId = raw;
      } else {
        console.warn("⚠️ appAccountToken presente mas não é UUID válido");
      }
    }

    if (!userId) {
      userId = await selectUserIdByOriginalTransactionId(originalTransactionId);
    }

    if (!userId) {
      console.error(
        "❌ user_id não encontrado — use appAccountToken = UUID Supabase na compra (iOS).",
      );
      return new Response("ok", { status: 200 });
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
          const ren = decodeJWSPayload<{ autoRenewStatus?: number }>(
            signedRenewal,
          );
          if (ren.autoRenewStatus === 0) autoRenew = false;
        }
      } catch {
        /* ignora */
      }
    }

    const appleMetaLayer: JsonRecord = {
      source: "apple_asn_v2",
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
      platform: "ios" as const,
      status,
      purchased_at: purchasedAt,
      expires_at: expiresAt,
      cancelled_at: cancelledAt,
      store_original_transaction_id: originalTransactionId,
      store_latest_transaction_id: transactionId,
      auto_renew: autoRenew,
      metadata,
    });

    const existingByTx = await selectRowByLatestTransactionId(
      userId,
      transactionId,
    );

    if (existingByTx) {
      const metadata = mergeAppleServerMetadata(
        existingByTx.metadata,
        appleMetaLayer,
      );
      const { error } = await supabase
        .from("user_subscriptions")
        .update(rowPayload(metadata))
        .eq("id", existingByTx.id);
      if (error) {
        console.error(
          "❌ Update (confirm por transactionId) user_subscriptions:",
          error.message,
        );
        return new Response("db error", { status: 500 });
      }
      await expireOtherIosPendingDuplicates(userId, existingByTx.id);
      console.log(
        "✅ Apple confirmou registro já criado pelo app (mesmo transactionId)",
      );
      await syncUserPlanActive(userId, status, expiresAt);
      return new Response("ok", { status: 200 });
    }

    const existingSub = await selectRowByOriginalTransactionId(
      userId,
      originalTransactionId,
    );

    if (existingSub) {
      const metadata = mergeAppleServerMetadata(
        existingSub.metadata,
        appleMetaLayer,
      );
      const { error } = await supabase
        .from("user_subscriptions")
        .update(rowPayload(metadata))
        .eq("id", existingSub.id);
      if (error) {
        console.error("❌ Update user_subscriptions:", error.message);
        return new Response("db error", { status: 500 });
      }
      await expireOtherIosPendingDuplicates(userId, existingSub.id);
      console.log("🔄 Assinatura atualizada (original_transaction_id)");
    } else {
      const consolidateRow = await selectIosRowToMergeAppleWebhook(userId);

      if (consolidateRow) {
        const metadata = mergeAppleServerMetadata(
          consolidateRow.metadata,
          appleMetaLayer,
        );
        const { error } = await supabase
          .from("user_subscriptions")
          .update(rowPayload(metadata))
          .eq("id", consolidateRow.id);
        if (error) {
          console.error(
            "❌ Update user_subscriptions (consolidado iOS por user_id):",
            error.message,
          );
          return new Response("db error", { status: 500 });
        }
        await expireOtherIosPendingDuplicates(userId, consolidateRow.id);
        console.log(
          "🔄 Assinatura atualizada na linha iOS existente do usuário (sem INSERT)",
        );
      } else {
        if (status === "active" || status === "grace_period") {
          await expireIosNonManualForAppleReplace(userId);
        }

        const metadata = mergeAppleServerMetadata({}, appleMetaLayer);
        const { data: insertedRows, error } = await supabase
          .from("user_subscriptions")
          .insert(rowPayload(metadata))
          .select("id");
        if (error) {
          console.error("❌ Insert user_subscriptions:", error.message);
          return new Response("db error", { status: 500 });
        }
        const insertedId = insertedRows?.[0]?.id;
        if (insertedId) {
          await expireOtherIosPendingDuplicates(userId, insertedId);
        }
        console.log("🆕 Assinatura criada (primeira linha iOS para o usuário)");
      }
    }

    await syncUserPlanActive(userId, status, expiresAt);

    return new Response("ok", { status: 200 });
  } catch (err) {
    console.error("❌ Erro:", err);
    return new Response("error", { status: 500 });
  }
});
