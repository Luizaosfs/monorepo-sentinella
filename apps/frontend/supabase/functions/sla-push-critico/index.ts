/**
 * Edge Function: sla-push-critico
 *
 * Envia notificações Web Push para usuários com SLAs que expiram em ≤ 1 hora.
 *
 * Agendar via Supabase Cron Jobs:
 *   "0 * * * *"  — a cada hora (ou "0/30 * * * *" a cada 30 min)
 *
 * Secrets necessários (Supabase Dashboard → Edge Functions → Secrets):
 *   VAPID_PUBLIC_KEY   — chave pública VAPID (base64url)
 *   VAPID_PRIVATE_KEY  — chave privada VAPID (base64url)
 *   VAPID_SUBJECT      — mailto:seu@email.com (ou URL do app)
 *
 * Gerar chaves VAPID:
 *   npx web-push generate-vapid-keys
 *
 * Chamada manual:
 *   curl -X POST https://<project>.supabase.co/functions/v1/sla-push-critico \
 *        -H "Authorization: Bearer <service_role_key>"
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import webpush from "npm:web-push@3.6.7";

const ALLOWED_ORIGIN = Deno.env.get("APP_ORIGIN") ?? "https://app.sentinella.com.br";
const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Impede chamadas externas não autorizadas — função exclusiva de cron interno.
  const cronSecret = req.headers.get("x-cron-secret");
  if (cronSecret !== Deno.env.get("CRON_SECRET")) {
    return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  }

  try {
    const supabaseUrl    = Deno.env.get("SUPABASE_URL")!;
    const serviceKey     = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const vapidPublic    = Deno.env.get("VAPID_PUBLIC_KEY")!;
    const vapidPrivate   = Deno.env.get("VAPID_PRIVATE_KEY")!;
    const vapidSubject   = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@sentinelaweb.com.br";

    if (!vapidPublic || !vapidPrivate) {
      return new Response(
        JSON.stringify({ ok: false, error: "VAPID keys não configuradas. Adicione VAPID_PUBLIC_KEY e VAPID_PRIVATE_KEY nos secrets da Edge Function." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

    const sb = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    // Busca SLAs críticos: pendente/em_atendimento e prazo expira em ≤ 1 hora
    const oneHourFromNow = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const { data: slas, error: slaError } = await sb
      .from("sla_operacional")
      .select("id, cliente_id, prioridade, prazo_final, item:pluvio_operacional_item(bairro_nome), levantamento_item:levantamento_itens(item, endereco_curto)")
      .in("status", ["pendente", "em_atendimento"])
      .lte("prazo_final", oneHourFromNow)
      .gte("prazo_final", new Date().toISOString()); // ainda não expirado

    if (slaError) throw slaError;
    if (!slas || slas.length === 0) {
      return new Response(JSON.stringify({ ok: true, notificados: 0, mensagem: "Nenhum SLA crítico encontrado." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Agrupa por cliente para buscar assinaturas
    const clienteIds = [...new Set(slas.map((s: Record<string, unknown>) => s.cliente_id as string))];

    let notificados = 0;
    let falhas = 0;

    for (const clienteId of clienteIds) {
      const { data: subs, error: subsError } = await sb
        .from("push_subscriptions")
        .select("endpoint, p256dh, auth")
        .eq("cliente_id", clienteId);

      if (subsError || !subs || subs.length === 0) continue;

      const clienteSlas = slas.filter((s: Record<string, unknown>) => s.cliente_id === clienteId);

      for (const sub of subs) {
        const slaTitles = clienteSlas.map((s: Record<string, unknown>) => {
          const item = (s.levantamento_item as Record<string, string> | null);
          const pluvio = (s.item as Record<string, string> | null);
          const local = item?.endereco_curto || item?.item || pluvio?.bairro_nome || "Local desconhecido";
          return local;
        });

        const body = slaTitles.length === 1
          ? `SLA prestes a vencer: ${slaTitles[0]}`
          : `${slaTitles.length} SLAs prestes a vencer`;

        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            JSON.stringify({
              title: "⏰ SLA Crítico — SentinelaWeb",
              body,
              tag: `sla-critico-${clienteId}`,
              url: "/admin/sla",
            })
          );
          notificados++;
        } catch (err) {
          console.warn(`[sla-push-critico] Falha ao enviar push (endpoint omitido):`, (err as Error)?.message ?? 'erro desconhecido');
          falhas++;

          // Remove assinaturas inválidas (410 Gone = não mais válida)
          if ((err as { statusCode?: number }).statusCode === 410) {
            await sb.from("push_subscriptions").delete().eq("endpoint", sub.endpoint).catch(() => undefined);
          }
        }
      }
    }

    const result = {
      ok: true,
      slas_criticos: slas.length,
      notificados,
      falhas,
      executado_em: new Date().toISOString(),
    };

    console.log(`[sla-push-critico] concluído — notificados=${result.notificados} falhas=${result.falhas}`);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[sla-push-critico] Erro:", msg);
    return new Response(
      JSON.stringify({ ok: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
