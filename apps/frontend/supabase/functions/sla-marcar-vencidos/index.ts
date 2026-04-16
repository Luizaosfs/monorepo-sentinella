/**
 * Edge Function: sla-marcar-vencidos
 *
 * Executa a cada 15 minutos (via Supabase Cron Jobs):
 *   1. Marca como 'vencido' todos os SLAs com prazo_final < now()
 *   2. Escala automaticamente SLAs nos últimos 20% do prazo (iminentes)
 *
 * Ordem importa: vencidos primeiro, depois iminentes — evita escalar algo
 * que seria vencido na mesma rodada.
 *
 * Cron: "0/15 * * * *" (a cada 15 minutos)
 * Chamada manual:
 *   curl -X POST https://<project>.supabase.co/functions/v1/sla-marcar-vencidos \
 *        -H "Authorization: Bearer <service_role_key>"
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("APP_ORIGIN") ?? "https://app.sentinella.com.br",
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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Service role bypassa RLS — necessário pois não há usuário autenticado
    const sb = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    // 1. Marca SLAs vencidos (todos os clientes)
    const { data: vencidosData, error: vencidosError } = await sb.rpc("marcar_slas_vencidos", {
      p_cliente_id: null,
    });
    if (vencidosError) throw vencidosError;

    // 2. Escala SLAs iminentes (últimos 20% do prazo)
    const { data: iminentesData, error: iminentesError } = await sb.rpc("escalar_slas_iminentes", {
      p_cliente_id: null,
      p_limiar_pct: 20,
    });
    if (iminentesError) throw iminentesError;

    const result = {
      ok: true,
      vencidos_marcados:   typeof vencidosData  === "number" ? vencidosData  : 0,
      iminentes_escalados: typeof iminentesData === "number" ? iminentesData : 0,
      executado_em: new Date().toISOString(),
    };

    console.log(`[sla-marcar-vencidos] concluído — vencidos=${result.vencidos ?? 0} escalados=${result.escalados ?? 0}`);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[sla-marcar-vencidos] Erro:", msg);

    return new Response(
      JSON.stringify({ ok: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
