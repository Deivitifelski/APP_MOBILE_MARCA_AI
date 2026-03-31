// Edge Function: send-push-single
// URL: https://<project>.supabase.co/functions/v1/send-push-single
// Envia push FCM v1 para um único token (mesma base robusta do send-push).

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { GoogleAuth } from "npm:google-auth-library@9.0.0";

const FCM_JSON = Deno.env.get("FCM_SERVICE_ACCOUNT")!;

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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    if (!FCM_JSON) {
      return new Response(
        JSON.stringify({ error: "FCM_SERVICE_ACCOUNT não configurada no Supabase" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { token, title, body: messageBody, data, badge } = body || {};

    if (!token || !title || !messageBody) {
      return new Response(
        JSON.stringify({ error: "token, title e body são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const serviceAccount = JSON.parse(FCM_JSON) as { project_id: string };
    const auth = new GoogleAuth({
      credentials: serviceAccount as Record<string, unknown>,
      scopes: ["https://www.googleapis.com/auth/cloud-platform"],
    });
    const client = await auth.getClient();
    const projectId = serviceAccount.project_id;
    const fcmUrl = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

    const fcmData = normalizeFcmData(typeof data === "object" && data !== null ? data : {});
    const badgeNum = typeof badge === "number" ? Math.max(0, badge) : 1;

    const payload = {
      message: {
        token,
        notification: {
          title,
          body: messageBody,
        },
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

    const res = await client.request({
      url: fcmUrl,
      method: "POST",
      data: payload,
    });

    return new Response(
      JSON.stringify({ success: true, response: res.data }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

