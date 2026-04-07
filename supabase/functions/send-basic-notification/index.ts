// Edge Function: send-basic-notification
// URL: https://<project>.supabase.co/functions/v1/send-basic-notification
//
// Envia notificação informativa (type = basic) para:
// - Um usuário específico (to_user_id)
// - Todos os usuários (send_to_all = true)
//
// Variáveis de ambiente:
// - SUPABASE_URL
// - SUPABASE_SERVICE_ROLE_KEY
// - FCM_SERVICE_ACCOUNT (JSON da service account do Firebase)

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { GoogleAuth } from "npm:google-auth-library@9.0.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FCM_JSON = Deno.env.get("FCM_SERVICE_ACCOUNT")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalizeFcmData(data: Record<string, unknown> | null | undefined): Record<string, string> {
  if (!data || typeof data !== "object") return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(data)) {
    out[k] = typeof v === "string" ? v : JSON.stringify(v);
  }
  return out;
}

type UserTokenRow = { id: string; token_fcm: string | null };

async function sendPushForUser(params: {
  serviceAccount: { project_id: string; [key: string]: unknown };
  toUserId: string;
  token: string;
  title: string;
  message: string;
  notificationId?: string;
}) {
  const { serviceAccount, toUserId, token, title, message, notificationId } = params;

  const { count, error: countErr } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("to_user_id", toUserId)
    .eq("read", false);

  const badgeNum = countErr || count == null ? 1 : Math.max(1, count);

  const fcmData = normalizeFcmData({
    type: "basic",
    ...(notificationId ? { notification_id: notificationId } : {}),
  });

  const auth = new GoogleAuth({
    credentials: serviceAccount,
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  });
  const client = await auth.getClient();
  const projectId = serviceAccount.project_id;
  const fcmUrl = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

  const payload = {
    message: {
      token,
      notification: { title, body: message },
      data: { ...fcmData, badge: String(badgeNum) },
      android: {
        priority: "high",
        notification: { sound: "default", channelId: "default" },
      },
      apns: {
        payload: {
          aps: {
            sound: "default",
            contentAvailable: true,
            badge: badgeNum,
          },
        },
      },
    },
  };

  try {
    await client.request({
      url: fcmUrl,
      method: "POST",
      data: payload,
    });
    return { status: "sent" as const };
  } catch (fcmError: unknown) {
    const errorMsg = fcmError instanceof Error ? fcmError.message : String(fcmError);
    if (
      errorMsg.includes("UNREGISTERED") ||
      errorMsg.includes("INVALID_ARGUMENT") ||
      errorMsg.includes("NOT_FOUND")
    ) {
      await supabase.from("users").update({ token_fcm: null }).eq("id", toUserId);
    }
    return { status: "error" as const, error: errorMsg };
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Use POST" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    if (!FCM_JSON) {
      return new Response(
        JSON.stringify({ error: "FCM_SERVICE_ACCOUNT não configurada no Supabase" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let serviceAccount: { project_id: string; [key: string]: unknown };
    try {
      serviceAccount = JSON.parse(FCM_JSON);
    } catch {
      return new Response(
        JSON.stringify({ error: "FCM_SERVICE_ACCOUNT inválido (JSON)" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json();
    const {
      to_user_id,
      send_to_all,
      title,
      message,
      from_user_id,
      artist_id,
      skip_push,
      limit,
    } = body || {};

    if (!title || typeof title !== "string" || !message || typeof message !== "string") {
      return new Response(
        JSON.stringify({ error: "title e message são obrigatórios (string)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const isBroadcast = send_to_all === true;

    if (!isBroadcast && (!to_user_id || typeof to_user_id !== "string")) {
      return new Response(
        JSON.stringify({ error: "to_user_id é obrigatório quando send_to_all=false" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!isBroadcast) {
      const { data: inserted, error: insertError } = await supabase
        .from("notifications")
        .insert({
          to_user_id,
          from_user_id: from_user_id ?? null,
          artist_id: artist_id ?? null,
          event_id: null,
          title,
          message,
          type: "basic",
          read: false,
          status: null,
          role: null,
          created_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (insertError) {
        return new Response(
          JSON.stringify({ error: insertError.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const notificationId = inserted?.id as string;

      if (skip_push === true) {
        return new Response(
          JSON.stringify({ success: true, notification_id: notificationId, push: "skipped" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const { data: userRow, error: userErr } = await supabase
        .from("users")
        .select("id, token_fcm")
        .eq("id", to_user_id)
        .maybeSingle();

      if (userErr) {
        return new Response(
          JSON.stringify({ success: true, notification_id: notificationId, push: "error", push_error: userErr.message }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const token = userRow?.token_fcm;
      if (!token) {
        return new Response(
          JSON.stringify({ success: true, notification_id: notificationId, push: "skipped", reason: "sem token_fcm" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const pushResult = await sendPushForUser({
        serviceAccount,
        toUserId: to_user_id,
        token,
        title,
        message,
        notificationId,
      });

      return new Response(
        JSON.stringify({
          success: true,
          notification_id: notificationId,
          push: pushResult.status,
          ...(pushResult.status === "error" ? { push_error: pushResult.error } : {}),
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const hardLimit = typeof limit === "number" && limit > 0 ? Math.min(limit, 10000) : 5000;

    const { data: users, error: usersErr } = await supabase
      .from("users")
      .select("id, token_fcm")
      .not("id", "is", null)
      .limit(hardLimit);

    if (usersErr) {
      return new Response(
        JSON.stringify({ error: usersErr.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const recipients = (users ?? []) as UserTokenRow[];
    if (recipients.length === 0) {
      return new Response(
        JSON.stringify({ success: true, mode: "broadcast", inserted: 0, push_sent: 0, push_skipped: 0, push_error: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const nowIso = new Date().toISOString();
    const notificationRows = recipients.map((u) => ({
      to_user_id: u.id,
      from_user_id: from_user_id ?? null,
      artist_id: artist_id ?? null,
      event_id: null,
      title,
      message,
      type: "basic",
      read: false,
      status: null,
      role: null,
      created_at: nowIso,
    }));

    const { error: bulkInsertError } = await supabase.from("notifications").insert(notificationRows);
    if (bulkInsertError) {
      return new Response(
        JSON.stringify({ error: bulkInsertError.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (skip_push === true) {
      return new Response(
        JSON.stringify({
          success: true,
          mode: "broadcast",
          inserted: recipients.length,
          push_sent: 0,
          push_skipped: recipients.length,
          push_error: 0,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let pushSent = 0;
    let pushSkipped = 0;
    let pushError = 0;

    for (const user of recipients) {
      const token = user.token_fcm;
      if (!token) {
        pushSkipped += 1;
        continue;
      }

      const result = await sendPushForUser({
        serviceAccount,
        toUserId: user.id,
        token,
        title,
        message,
      });

      if (result.status === "sent") pushSent += 1;
      else pushError += 1;
    }

    return new Response(
      JSON.stringify({
        success: true,
        mode: "broadcast",
        inserted: recipients.length,
        push_sent: pushSent,
        push_skipped: pushSkipped,
        push_error: pushError,
        limit_used: hardLimit,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("send-basic-notification:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
