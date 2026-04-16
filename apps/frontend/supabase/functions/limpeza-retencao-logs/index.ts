/**
 * limpeza-retencao-logs — QW-10C / QW-10D
 *
 * Executa em sequência (SEMPRE com dry_run=true por padrão):
 *   1. fn_redact_sensitive_log_fields(dry_run) — nullifica resposta_api e clusters expirados
 *   2. fn_purge_expired_logs(dry_run)          — deleta registros com retention_until vencido
 *
 * Parâmetros (body JSON):
 *   dry_run?: boolean  — se true (PADRÃO), apenas simula. Enviar false explicitamente para executar.
 *   apenas_redact?: boolean — se true, executa somente a redação sem purga
 *
 * Agendar via Supabase Dashboard → Cron Jobs:
 *   "0 2 * * *"  — todo dia às 02:00 UTC (recomendado)
 *
 * Execução manual (dry_run — inspecionar):
 *   curl -X POST .../functions/v1/limpeza-retencao-logs \
 *     -H "Authorization: Bearer <service_role_key>" \
 *     -d '{"dry_run": true}'
 *
 * Execução real (exige dry_run=false explícito):
 *   curl -X POST .../functions/v1/limpeza-retencao-logs \
 *     -H "Authorization: Bearer <service_role_key>" \
 *     -d '{"dry_run": false}'
 *
 * Requer secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL          = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_ORIGIN') ?? 'https://app.sentinella.com.br',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Validação de CRON_SECRET — impede chamadas externas não autorizadas.
  const cronSecret = req.headers.get('x-cron-secret');
  if (cronSecret !== Deno.env.get('CRON_SECRET')) {
    return new Response('Unauthorized', { status: 401, headers: corsHeaders });
  }

  const startedAt = new Date().toISOString();

  try {
    const body = req.method === 'POST'
      ? await req.json().catch(() => ({}))
      : {};

    // Dry run é o padrão — nunca executa sem confirmação explícita
    const dry_run        = body.dry_run !== false;   // default true
    const apenas_redact  = body.apenas_redact === true;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false },
    });

    // ── 1. Redação de campos sensíveis ─────────────────────────────────────
    const { data: redactData, error: redactError } = await supabase
      .rpc('fn_redact_sensitive_log_fields', { p_dry_run: dry_run });

    if (redactError) {
      console.error('[limpeza-retencao-logs] redact error:', redactError);
      return new Response(JSON.stringify({
        ok: false,
        fase: 'redact',
        error: redactError.message,
        dry_run,
        started_at: startedAt,
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (apenas_redact) {
      return new Response(JSON.stringify({
        ok: true,
        dry_run,
        apenas_redact: true,
        redact: redactData,
        started_at: startedAt,
        finished_at: new Date().toISOString(),
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── 2. Purga de logs expirados ─────────────────────────────────────────
    const { data: purgeData, error: purgeError } = await supabase
      .rpc('fn_purge_expired_logs', { p_dry_run: dry_run });

    if (purgeError) {
      console.error('[limpeza-retencao-logs] purge error:', purgeError);
      return new Response(JSON.stringify({
        ok: false,
        fase: 'purge',
        error: purgeError.message,
        dry_run,
        redact: redactData,
        started_at: startedAt,
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── 3. Sumário ─────────────────────────────────────────────────────────
    const totalRedact = (redactData?.esus_resposta_api ?? 0)
                      + (redactData?.analise_ia_clusters ?? 0);
    const totalPurge  = purgeData?.total ?? 0;

    console.log(`[limpeza-retencao-logs] dry_run=${dry_run} | redact=${totalRedact} | purge=${totalPurge}`);

    return new Response(JSON.stringify({
      ok: true,
      dry_run,
      redact: redactData,
      purge: purgeData,
      totais: { campos_redatados: totalRedact, registros_purgados: totalPurge },
      started_at: startedAt,
      finished_at: new Date().toISOString(),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[limpeza-retencao-logs] unexpected error:', message);
    return new Response(JSON.stringify({
      ok: false,
      error: message,
      started_at: startedAt,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
