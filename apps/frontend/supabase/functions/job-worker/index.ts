// =============================================================================
// QW-13 — Edge Function: job-worker
// Drena a fila job_queue: clama um job por vez, executa o handler e registra
// o resultado. Executa via cron (*/1 * * * *) e pode ser chamado manualmente.
//
// Tipos de job suportados:
//   triagem_ia         — triagem IA pós-voo (claude haiku + cluster)
//   relatorio_semanal  — relatório HTML semanal via Resend
//   cnes_sync          — sincronização CNES para um cliente
//   limpeza_retencao   — purge/redact de logs (dry_run=false)
//   cloudinary_cleanup — remoção de imagens órfãs do Cloudinary
//   health_check       — dispara verificação de saúde da plataforma
//
// Retry: backoff exponencial (2^tentativas minutos, máximo 60 min).
// Máximo de tentativas configurável por job (default: 3).
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

// ── Tipos ──────────────────────────────────────────────────────────────────

interface Job {
  id: string;
  tipo: string;
  payload: Record<string, unknown>;
  tentativas: number;
  max_tentativas: number;
}

interface HandlerResult {
  ok: boolean;
  resultado?: Record<string, unknown>;
  erro?: string;
}

// ── Handlers por tipo de job ───────────────────────────────────────────────

async function invokeFunction(nome: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.functions.invoke(nome, { body });
  if (error) throw new Error(`[${nome}] ${error.message}`);
  return (data as Record<string, unknown>) ?? {};
}

async function handleTriagemIa(payload: Record<string, unknown>): Promise<HandlerResult> {
  if (!payload.levantamento_id || !payload.cliente_id) {
    return { ok: false, erro: 'Payload inválido: levantamento_id e cliente_id são obrigatórios' };
  }
  const resultado = await invokeFunction('triagem-ia-pos-voo', payload);
  return { ok: true, resultado };
}

async function handleRelatorioSemanal(payload: Record<string, unknown>): Promise<HandlerResult> {
  const resultado = await invokeFunction('relatorio-semanal', payload);
  return { ok: true, resultado };
}

async function handleCnesSync(payload: Record<string, unknown>): Promise<HandlerResult> {
  if (!payload.cliente_id) {
    return { ok: false, erro: 'Payload inválido: cliente_id é obrigatório para cnes_sync' };
  }
  // Chama via fetch (mesmo padrão de api.cnesSync.sincronizarManual)
  const resp = await fetch(`${SUPABASE_URL}/functions/v1/cnes-sync`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
    },
    body: JSON.stringify({ origem: 'job_worker', ...payload }),
  });
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`[cnes-sync] HTTP ${resp.status}: ${txt}`);
  }
  const resultado = await resp.json() as Record<string, unknown>;
  return { ok: true, resultado };
}

async function handleLimpezaRetencao(payload: Record<string, unknown>): Promise<HandlerResult> {
  // Garante que dry_run seja false quando executado pelo worker
  const resultado = await invokeFunction('limpeza-retencao-logs', {
    dry_run: false,
    ...payload,
  });
  return { ok: true, resultado };
}

async function handleCloudinaryCleanup(payload: Record<string, unknown>): Promise<HandlerResult> {
  const resultado = await invokeFunction('cloudinary-cleanup-orfaos', payload);
  return { ok: true, resultado };
}

async function handleHealthCheck(payload: Record<string, unknown>): Promise<HandlerResult> {
  const resultado = await invokeFunction('health-check', payload);
  return { ok: true, resultado };
}

const HANDLERS: Record<string, (payload: Record<string, unknown>) => Promise<HandlerResult>> = {
  triagem_ia: handleTriagemIa,
  relatorio_semanal: handleRelatorioSemanal,
  cnes_sync: handleCnesSync,
  limpeza_retencao: handleLimpezaRetencao,
  cloudinary_cleanup: handleCloudinaryCleanup,
  health_check: handleHealthCheck,
};

// ── Backoff exponencial ────────────────────────────────────────────────────

function proximaExecucaoApos(tentativas: number): string {
  const minutos = Math.min(Math.pow(2, tentativas), 60); // 2, 4, 8, 16, 32, 60
  return new Date(Date.now() + minutos * 60_000).toISOString();
}

// ── Ciclo principal ────────────────────────────────────────────────────────

async function processarJob(job: Job): Promise<void> {
  console.log(`[job-worker] Processando job ${job.id} (tipo: ${job.tipo}, tentativa: ${job.tentativas + 1})`);

  const handler = HANDLERS[job.tipo];
  if (!handler) {
    await supabase
      .from('job_queue')
      .update({
        status: 'falhou',
        concluido_em: new Date().toISOString(),
        erro: `Tipo de job desconhecido: ${job.tipo}`,
      })
      .eq('id', job.id);
    return;
  }

  try {
    const resultado = await handler(job.payload);

    if (resultado.ok) {
      await supabase
        .from('job_queue')
        .update({
          status: 'concluido',
          concluido_em: new Date().toISOString(),
          resultado: resultado.resultado ?? null,
          tentativas: job.tentativas + 1,
        })
        .eq('id', job.id);

      console.log(`[job-worker] Job ${job.id} concluído com sucesso.`);
    } else {
      // Falha lógica (sem exceção) — não faz retry
      await supabase
        .from('job_queue')
        .update({
          status: 'falhou',
          concluido_em: new Date().toISOString(),
          erro: resultado.erro ?? 'Falha sem mensagem de erro',
          tentativas: job.tentativas + 1,
        })
        .eq('id', job.id);

      console.warn(`[job-worker] Job ${job.id} falhou: ${resultado.erro}`);
    }
  } catch (err) {
    const mensagemErro = err instanceof Error ? err.message : String(err);
    const proximaTentativa = job.tentativas + 1;

    if (proximaTentativa >= job.max_tentativas) {
      // Esgotou as tentativas — marca como falhou definitivamente
      await supabase
        .from('job_queue')
        .update({
          status: 'falhou',
          concluido_em: new Date().toISOString(),
          erro: mensagemErro,
          tentativas: proximaTentativa,
        })
        .eq('id', job.id);

      // Gera alerta no system_alerts
      await supabase.from('system_alerts').insert({
        servico: `job_worker:${job.tipo}`,
        nivel: 'warning',
        mensagem: `Job ${job.id} (${job.tipo}) falhou após ${proximaTentativa} tentativas: ${mensagemErro.slice(0, 300)}`,
      });

      console.error(`[job-worker] Job ${job.id} falhou definitivamente após ${proximaTentativa} tentativas.`);
    } else {
      // Reagenda com backoff exponencial
      await supabase
        .from('job_queue')
        .update({
          status: 'pendente',
          iniciado_em: null,
          erro: mensagemErro,
          tentativas: proximaTentativa,
          executar_em: proximaExecucaoApos(proximaTentativa),
        })
        .eq('id', job.id);

      console.warn(`[job-worker] Job ${job.id} reagendado (tentativa ${proximaTentativa}/${job.max_tentativas}).`);
    }
  }
}

// ── Handler HTTP ───────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }

  // Validação de CRON_SECRET — impede chamadas externas não autorizadas.
  const cronSecret = req.headers.get('x-cron-secret');
  if (cronSecret !== Deno.env.get('CRON_SECRET')) {
    return new Response('Unauthorized', { status: 401 });
  }

  // QW-17: round-robin — clama 1 job por cliente ativo, até MAX_JOBS em paralelo.
  // Evita starvation: um cliente com fila longa não bloqueia os demais.
  const MAX_JOBS = 5;

  const { data: jobs, error } = await supabase.rpc('fn_claim_jobs_round_robin', { p_max: MAX_JOBS });

  if (error) {
    console.error('[job-worker] Erro ao clamar jobs (round-robin):', error.message);
    return new Response(
      JSON.stringify({ processados: 0, jobs: [], erro: error.message, executado_em: new Date().toISOString() }),
      { headers: { 'Content-Type': 'application/json' }, status: 500 },
    );
  }

  if (!jobs || jobs.length === 0) {
    console.log('[job-worker] Fila vazia.');
    return new Response(
      JSON.stringify({ processados: 0, jobs: [], executado_em: new Date().toISOString() }),
      { headers: { 'Content-Type': 'application/json' }, status: 200 },
    );
  }

  // Processa todos os jobs reivindicados em paralelo
  const resultados = await Promise.allSettled((jobs as Job[]).map(processarJob));

  const processados = resultados.filter((r) => r.status === 'fulfilled').length;
  const jobIds = (jobs as Job[]).map((j) => `${j.id}:${j.tipo}`);

  console.log(`[job-worker] Processados ${processados}/${jobs.length} jobs em paralelo (round-robin).`);

  return new Response(
    JSON.stringify({
      processados,
      jobs: jobIds,
      executado_em: new Date().toISOString(),
    }),
    { headers: { 'Content-Type': 'application/json' }, status: 200 },
  );
});
