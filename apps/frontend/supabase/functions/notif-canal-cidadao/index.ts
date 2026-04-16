/**
 * Edge Function: notif-canal-cidadao
 *
 * Processa jobs do tipo 'notif_canal_cidadao' da fila job_queue e envia
 * notificações Web Push para os gestores do cliente correspondente.
 *
 * Deve ser chamada pelo job-worker (cron) ou manualmente:
 *   curl -X POST https://<project>.supabase.co/functions/v1/notif-canal-cidadao \
 *        -H "Authorization: Bearer <service_role_key>"
 *
 * Secrets necessários:
 *   VAPID_PUBLIC_KEY   — chave pública VAPID (base64url)
 *   VAPID_PRIVATE_KEY  — chave privada VAPID (base64url)
 *   VAPID_SUBJECT      — mailto:seu@email.com (ou URL do app)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import webpush from "npm:web-push@3.6.7";

const ALLOWED_ORIGIN = Deno.env.get("APP_ORIGIN") ?? "https://app.sentinella.com.br";
const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface JobPayload {
  foco_id: string;
  cliente_id: string;
  latitude: number | null;
  longitude: number | null;
  endereco: string | null;
  suspeita_em: string | null;
  origem_item_id: string | null;
}

interface JobRow {
  id: string;
  tipo: string;
  payload: JobPayload;
  tentativas: number;
}

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
    const supabaseUrl  = Deno.env.get("SUPABASE_URL")!;
    const serviceKey   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const vapidPublic  = Deno.env.get("VAPID_PUBLIC_KEY")!;
    const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY")!;
    const vapidSubject = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@sentinelaweb.com.br";

    if (!vapidPublic || !vapidPrivate) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "VAPID keys não configuradas. Adicione VAPID_PUBLIC_KEY e VAPID_PRIVATE_KEY nos secrets da Edge Function.",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

    const sb = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    // Busca jobs pendentes deste tipo
    const { data: jobs, error: jobsError } = await sb
      .from("job_queue")
      .select("id, tipo, payload, tentativas")
      .eq("tipo", "notif_canal_cidadao")
      .eq("status", "pendente")
      .lte("executar_em", new Date().toISOString())
      .order("executar_em", { ascending: true })
      .limit(50);

    if (jobsError) throw jobsError;

    if (!jobs || jobs.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, processados: 0, mensagem: "Nenhum job pendente." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let processados = 0;
    let falhas = 0;

    for (const job of jobs as JobRow[]) {
      // Marca como em_execucao (claim atômico simples)
      const { error: claimError } = await sb
        .from("job_queue")
        .update({ status: "em_execucao", iniciado_em: new Date().toISOString() })
        .eq("id", job.id)
        .eq("status", "pendente");

      if (claimError) {
        console.warn(`[notif-canal-cidadao] Não conseguiu fazer claim do job ${job.id}`);
        continue;
      }

      const p = job.payload;
      const endereco = p.endereco ?? "Endereço não informado";
      const focoId   = p.foco_id;
      const clienteId = p.cliente_id;

      let jobOk = true;
      let jobErro: string | undefined;
      let notifEnviadas = 0;
      let notifFalhas = 0;

      try {
        // Busca assinaturas Web Push do cliente
        const { data: subs, error: subsError } = await sb
          .from("push_subscriptions")
          .select("endpoint, p256dh, auth")
          .eq("cliente_id", clienteId);

        if (subsError) throw subsError;

        if (!subs || subs.length === 0) {
          console.log(`[notif-canal-cidadao] Nenhuma assinatura para cliente ${clienteId}`);
        } else {
          for (const sub of subs) {
            try {
              await webpush.sendNotification(
                { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                JSON.stringify({
                  title: "🦟 Nova denúncia de cidadão",
                  body: `Foco suspeito em: ${endereco}`,
                  icon: "/pwa-icon-192.png",
                  badge: "/favicon.svg",
                  tag: `canal-cidadao-${focoId}`,
                  data: {
                    url: `/gestor/focos/${focoId}`,
                    foco_id: focoId,
                    tipo: "canal_cidadao",
                  },
                })
              );
              notifEnviadas++;
            } catch (pushErr) {
              console.warn(
                `[notif-canal-cidadao] Falha ao enviar push (endpoint omitido):`,
                (pushErr as Error)?.message ?? "erro desconhecido"
              );
              notifFalhas++;

              // Remove assinaturas expiradas (410 Gone)
              if ((pushErr as { statusCode?: number }).statusCode === 410) {
                await sb
                  .from("push_subscriptions")
                  .delete()
                  .eq("endpoint", sub.endpoint)
                  .catch(() => undefined);
              }
            }
          }
        }
      } catch (err) {
        jobOk = false;
        jobErro = err instanceof Error ? err.message : String(err);
        console.error(`[notif-canal-cidadao] Erro no job ${job.id}:`, jobErro);
      }

      // Atualiza status final do job
      if (jobOk) {
        await sb
          .from("job_queue")
          .update({
            status: "concluido",
            concluido_em: new Date().toISOString(),
            resultado: { notif_enviadas: notifEnviadas, notif_falhas: notifFalhas },
          })
          .eq("id", job.id);
        processados++;
      } else {
        const novasTentativas = (job.tentativas ?? 0) + 1;
        const maxTentativas = 3;
        const statusFinal = novasTentativas >= maxTentativas ? "falhou" : "pendente";
        // Backoff exponencial: 2^tentativa minutos
        const backoffMs = Math.pow(2, novasTentativas) * 60 * 1000;
        const executarEm = new Date(Date.now() + backoffMs).toISOString();

        await sb
          .from("job_queue")
          .update({
            status: statusFinal,
            tentativas: novasTentativas,
            erro: jobErro,
            executar_em: statusFinal === "pendente" ? executarEm : undefined,
            concluido_em: statusFinal === "falhou" ? new Date().toISOString() : undefined,
          })
          .eq("id", job.id);
        falhas++;
      }
    }

    const result = {
      ok: true,
      jobs_encontrados: jobs.length,
      processados,
      falhas,
      executado_em: new Date().toISOString(),
    };

    console.log(
      `[notif-canal-cidadao] concluído — processados=${processados} falhas=${falhas}`
    );

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[notif-canal-cidadao] Erro fatal:", msg);
    return new Response(
      JSON.stringify({ ok: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
