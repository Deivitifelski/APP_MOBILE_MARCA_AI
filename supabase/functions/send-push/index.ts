// Edge Function: send-push
// URL: https://ctulmpyaikxsnjqmrzxf.supabase.co/functions/v1/send-push
// Envia notificação FCM v1 para membros do artista (exceto o criador do evento).
// Variável de ambiente: FCM_SERVICE_ACCOUNT (JSON da service account do Firebase)

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

/** FCM exige que `data` seja apenas chaves e valores string. */
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

    let serviceAccount: { project_id: string; [key: string]: unknown };
    try {
      serviceAccount = JSON.parse(FCM_JSON);
    } catch {
      return new Response(
        JSON.stringify({ error: "FCM_SERVICE_ACCOUNT inválido (JSON)" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { artist_id, creator_user_id, title, message, data, badge } = body;

    if (!artist_id || !creator_user_id) {
      return new Response(
        JSON.stringify({ error: "Dados obrigatórios faltando (artist_id ou creator_user_id)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: members, error: dbError } = await supabase
      .from("artist_members")
      .select(`
        user_id,
        users:user_id ( id, name, token_fcm )
      `)
      .eq("artist_id", artist_id)
      .neq("user_id", creator_user_id);

    if (dbError) throw dbError;

    const validUsers = members
      ?.map((m: { users?: { id: string; name?: string; token_fcm?: string } }) => m.users)
      .filter((u) => u && u.token_fcm) || [];

    if (validUsers.length === 0) {
      console.log("ℹ️ Nenhum destinatário com token_fcm encontrado.");
      return new Response(
        JSON.stringify({ message: "Nenhum token encontrado para notificar" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const auth = new GoogleAuth({
      credentials: serviceAccount,
      scopes: ["https://www.googleapis.com/auth/cloud-platform"],
    });
    const client = await auth.getClient();
    const projectId = serviceAccount.project_id;
    const fcmUrl = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

    console.log(`🚀 Iniciando envio para ${validUsers.length} dispositivos...`);

    const fcmData = normalizeFcmData(typeof data === "object" && data !== null ? data : {});

    const sendPromises = validUsers.map(async (user: { id: string; token_fcm: string }) => {
      const token = user.token_fcm;

      // Badge = contagem real de não lidas (contador do ícone sobe a cada notificação)
      let badgeNum: number;
      if (typeof badge === "number") {
        badgeNum = badge;
      } else {
        const { count, error: countErr } = await supabase
          .from("notifications")
          .select("*", { count: "exact", head: true })
          .eq("to_user_id", user.id)
          .eq("read", false);
        badgeNum = countErr || count == null ? 1 : Math.max(1, count);
      }
      console.log(`[FCM-SEND] Usuário: ${user.id} | Badge: ${badgeNum} | Token: ${token}`);

      const payload: Record<string, unknown> = {
        message: {
          token,
          notification: {
            title: title || "Nova atualização",
            body: message || "Confira as novidades do seu artista.",
          },
          data: fcmData,
          android: {
            priority: "high",
            notification: { sound: "default" },
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
        const res = await client.request({
          url: fcmUrl,
          method: "POST",
          data: payload,
        });
        console.log(`✅ Sucesso no envio para ${user.id}`);
        return { user_id: user.id, status: "success", response: res.data };
      } catch (fcmError: unknown) {
        const errorMsg = fcmError instanceof Error ? fcmError.message : String(fcmError);
        console.error(`❌ Erro ao enviar para ${user.id}:`, errorMsg);
        if (
          errorMsg.includes("UNREGISTERED") ||
          errorMsg.includes("INVALID_ARGUMENT") ||
          errorMsg.includes("NOT_FOUND")
        ) {
          console.warn(`🧹 Removendo token inválido do usuário ${user.id}.`);
          await supabase.from("users").update({ token_fcm: null }).eq("id", user.id);
        }
        return { user_id: user.id, status: "error", error: errorMsg };
      }
    });

    const results = await Promise.all(sendPromises);

    return new Response(JSON.stringify({ success: true, results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("💥 ERRO CRÍTICO NA EDGE FUNCTION:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
