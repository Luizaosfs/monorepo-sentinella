/**
 * Edge Function: relatorio-semanal
 *
 * Envia um relatório semanal por e-mail para cada cliente ativo via Resend.
 * Inclui: total de itens identificados, resolvidos, pendentes e críticos na semana.
 *
 * Agendar via Supabase Cron Jobs:
 *   "0 8 * * 1"  — toda segunda-feira às 08:00 UTC
 *
 * Secrets necessários (Supabase Dashboard → Edge Functions → Secrets):
 *   RESEND_API_KEY  — chave da API Resend (resend.com)
 *   FROM_EMAIL      — remetente (ex: "Sentinella <noreply@sentinelaweb.com.br>")
 *
 * Chamada manual:
 *   curl -X POST https://<project>.supabase.co/functions/v1/relatorio-semanal \
 *        -H "Authorization: Bearer <service_role_key>"
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const ALLOWED_ORIGIN = Deno.env.get('APP_ORIGIN') ?? 'https://app.sentinella.com.br';
const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ClienteStats {
  id: string;
  nome: string;
  email: string | null;
  total: number;
  resolvidos: number;
  pendentes: number;
  em_atendimento: number;
  criticos: number;
  altos: number;
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
    const resendKey    = Deno.env.get("RESEND_API_KEY");
    const fromEmail    = Deno.env.get("FROM_EMAIL") ?? "Sentinella <noreply@sentinelaweb.com.br>";

    if (!resendKey) {
      return new Response(
        JSON.stringify({ ok: false, error: "RESEND_API_KEY não configurada." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const sb = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    // ── 1. Busca clientes ativos com e-mail de contato ────────────────────────
    const { data: clientes, error: clientesError } = await sb
      .from("clientes")
      .select("id, nome, contato_email")
      .eq("ativo", true)
      .not("contato_email", "is", null);

    if (clientesError) throw clientesError;
    if (!clientes || clientes.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, enviados: 0, mensagem: "Nenhum cliente ativo com e-mail." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 2. Para cada cliente, busca stats da última semana ────────────────────
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const stats: ClienteStats[] = [];

    for (const cliente of clientes) {
      const { data: focos } = await sb
        .from("focos_risco")
        .select("status, prioridade")
        .eq("cliente_id", cliente.id)
        .gte("suspeita_em", sevenDaysAgo);

      const rows = focos || [];
      const total = rows.length;
      const resolvidos = rows.filter((i: Record<string, unknown>) => {
        const s = String(i.status || "").toLowerCase();
        return s === "resolvido" || s === "descartado" || s === "cancelado";
      }).length;
      const em_atendimento = rows.filter((i: Record<string, unknown>) => {
        const s = String(i.status || "").toLowerCase();
        return s === "em_triagem" || s === "em_tratamento" || s === "confirmado";
      }).length;
      const pendentes = rows.filter((i: Record<string, unknown>) => {
        const s = String(i.status || "").toLowerCase();
        return s === "" || s === "suspeita" || s === "aguarda_inspecao";
      }).length;
      const criticos = rows.filter((i: Record<string, unknown>) => String(i.prioridade || "").toUpperCase() === "P1").length;
      const altos = rows.filter((i: Record<string, unknown>) => String(i.prioridade || "").toUpperCase() === "P2").length;

      stats.push({ id: cliente.id, nome: cliente.nome, email: cliente.contato_email, total, resolvidos, em_atendimento, pendentes, criticos, altos });
    }

    // ── 3. Envia e-mail para cada cliente ─────────────────────────────────────
    const semana = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
    let enviados = 0;
    let falhas = 0;
    const erros: string[] = [];

    // QW-17: stagger de 300ms entre envios para respeitar rate limit do Resend
    // (100 req/s no plano free, 10 req/s é margem segura para múltiplos clientes).
    const STAGGER_MS = 300;

    for (let idx = 0; idx < stats.length; idx++) {
      const s = stats[idx];
      if (!s.email) continue;

      // Aguarda antes de enviar (exceto no primeiro)
      if (idx > 0) await new Promise((r) => setTimeout(r, STAGGER_MS));

      const html = buildEmailHtml(s, semana);

      // QW-09 Correção 4: retry 2x com backoff exponencial
      let enviado = false;
      let lastStatus = 0;
      let lastBody = "";
      for (let tentativa = 1; tentativa <= 3; tentativa++) {
        if (tentativa > 1) await new Promise((r) => setTimeout(r, tentativa * 1000));
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: fromEmail,
            to: [s.email],
            subject: `📊 Relatório Semanal Sentinella — ${s.nome} (${semana})`,
            html,
          }),
        });
        if (res.ok) { enviado = true; break; }
        lastStatus = res.status;
        lastBody = await res.text().catch(() => "");
        console.warn(`[relatorio-semanal] Tentativa ${tentativa}/3 falhou para ${s.email}:`, lastStatus, lastBody.slice(0, 100));
      }

      if (enviado) {
        enviados++;
      } else {
        falhas++;
        erros.push(`${s.nome}: ${lastStatus} ${lastBody.slice(0, 100)}`);
      }
    }

    const result = { ok: true, clientes: stats.length, enviados, falhas, erros, executado_em: new Date().toISOString() };
    console.log("[relatorio-semanal]", JSON.stringify({ ok: true, clientes: stats.length, enviados, falhas }));

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[relatorio-semanal] Erro:", msg);
    return new Response(
      JSON.stringify({ ok: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ── HTML do e-mail ─────────────────────────────────────────────────────────────

function buildEmailHtml(s: ClienteStats, semana: string): string {
  const resolucaoRate = s.total > 0 ? Math.round((s.resolvidos / s.total) * 100) : 0;
  const barWidth = `${resolucaoRate}%`;

  const statCard = (label: string, value: number, color: string) =>
    `<td style="padding:12px 8px;text-align:center;">
      <div style="background:${color};border-radius:12px;padding:16px 20px;min-width:80px;">
        <div style="font-size:28px;font-weight:900;color:#fff;">${value}</div>
        <div style="font-size:11px;color:rgba(255,255,255,0.85);font-weight:600;margin-top:4px;text-transform:uppercase;letter-spacing:0.05em;">${label}</div>
      </div>
    </td>`;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Relatório Semanal</title></head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4f8;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08);">

        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#2a9d8f,#1a7a6e);padding:32px 40px;">
          <div style="font-size:22px;font-weight:900;color:#fff;letter-spacing:-.5px;">📊 Relatório Semanal</div>
          <div style="font-size:14px;color:rgba(255,255,255,.8);margin-top:6px;">${s.nome} · Semana até ${semana}</div>
        </td></tr>

        <!-- Stats -->
        <tr><td style="padding:32px 32px 16px;">
          <p style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#64748b;margin:0 0 16px;">Resumo da Semana</p>
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              ${statCard("Identificados", s.total, "#334155")}
              ${statCard("Resolvidos", s.resolvidos, "#16a34a")}
              ${statCard("Pendentes", s.pendentes, "#2563eb")}
              ${statCard("Em Atend.", s.em_atendimento, "#7c3aed")}
            </tr>
          </table>
        </td></tr>

        <!-- Criticidade -->
        ${(s.criticos > 0 || s.altos > 0) ? `
        <tr><td style="padding:0 32px 24px;">
          <p style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#64748b;margin:0 0 12px;">Focos de Atenção</p>
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              ${s.criticos > 0 ? statCard("Críticos", s.criticos, "#dc2626") : ""}
              ${s.altos > 0 ? statCard("Altos", s.altos, "#ea580c") : ""}
            </tr>
          </table>
        </td></tr>` : ""}

        <!-- Taxa de resolução -->
        <tr><td style="padding:0 32px 32px;">
          <p style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#64748b;margin:0 0 8px;">Taxa de Resolução</p>
          <div style="background:#e2e8f0;border-radius:99px;height:10px;overflow:hidden;">
            <div style="background:linear-gradient(90deg,#16a34a,#22c55e);height:100%;width:${barWidth};border-radius:99px;transition:width .3s;"></div>
          </div>
          <div style="font-size:13px;color:#475569;margin-top:6px;font-weight:600;">${resolucaoRate}% dos itens identificados foram resolvidos</div>
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#f8fafc;padding:20px 32px;border-top:1px solid #e2e8f0;">
          <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;">
            Sentinella — Monitoramento de Focos de Dengue · Relatório gerado automaticamente em ${new Date().toLocaleString("pt-BR")}
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
