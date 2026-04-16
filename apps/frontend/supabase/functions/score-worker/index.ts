/**
 * Edge Function: score-worker
 * Processa jobs da job_queue para recálculo de score territorial.
 * Invocada por cron a cada 5 minutos (configurar no Supabase Dashboard).
 *
 * Tipos de job processados:
 * - recalcular_score_imovel:  recalcula 1 imóvel específico
 * - recalcular_score_por_caso: recalcula imóveis em raio de 300m do caso
 * - recalcular_score_lote:    recalcula todos os imóveis do cliente (cron diário)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const BATCH_SIZE = 50;
const JOB_TIMEOUT_MS = 10_000; // 10s por job

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout após ${ms}ms`)), ms)
    ),
  ]);
}

serve(async (req: Request) => {
  // Impede chamadas externas não autorizadas — worker exclusivo de cron interno.
  const cronSecret = req.headers.get('x-cron-secret');
  if (cronSecret !== Deno.env.get('CRON_SECRET')) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { data: jobs, error: fetchErr } = await supabase
    .from('job_queue')
    .select('*')
    .in('tipo', ['recalcular_score_imovel', 'recalcular_score_por_caso', 'recalcular_score_lote'])
    .eq('status', 'pendente')
    .order('criado_em', { ascending: true })
    .limit(BATCH_SIZE);

  if (fetchErr) {
    console.error('Erro ao buscar jobs:', fetchErr.message);
    return new Response(JSON.stringify({ error: fetchErr.message }), { status: 500 });
  }

  if (!jobs?.length) {
    return new Response(JSON.stringify({ processados: 0, erros: 0 }), { status: 200 });
  }

  let processados = 0;
  let erros = 0;

  for (const job of jobs) {
    // Marca como em execução
    await supabase
      .from('job_queue')
      .update({ status: 'em_execucao', iniciado_em: new Date().toISOString() })
      .eq('id', job.id);

    try {
      if (job.tipo === 'recalcular_score_imovel') {
        const { imovel_id, cliente_id } = job.payload as { imovel_id: string; cliente_id: string };
        if (!imovel_id || !cliente_id) throw new Error('payload inválido: imovel_id ou cliente_id ausente');

        const { error } = await withTimeout(
          supabase.rpc('fn_calcular_score_imovel', {
            p_imovel_id: imovel_id,
            p_cliente_id: cliente_id,
          }),
          JOB_TIMEOUT_MS,
        );
        if (error) throw error;

      } else if (job.tipo === 'recalcular_score_por_caso') {
        const { latitude, longitude, cliente_id, raio_m = 300 } = job.payload as {
          latitude: number;
          longitude: number;
          cliente_id: string;
          raio_m?: number;
        };
        if (!cliente_id || latitude == null || longitude == null) {
          throw new Error('payload inválido: campos obrigatórios ausentes');
        }

        // Aproximação com bounding box (±0.003° ≈ 300m)
        const delta = (raio_m / 111000) * 1.1;
        const { data: imoveis, error: imErr } = await supabase
          .from('imoveis')
          .select('id')
          .eq('cliente_id', cliente_id)
          .not('latitude', 'is', null)
          .not('longitude', 'is', null)
          .gte('latitude',  latitude  - delta)
          .lte('latitude',  latitude  + delta)
          .gte('longitude', longitude - delta)
          .lte('longitude', longitude + delta)
          .is('deleted_at', null)
          .limit(200);

        if (imErr) throw imErr;

        for (const im of (imoveis ?? [])) {
          const { error } = await supabase.rpc('fn_calcular_score_imovel', {
            p_imovel_id: im.id,
            p_cliente_id: cliente_id,
          });
          if (error) console.error(`Erro ao calcular score do imóvel ${im.id}:`, error.message);
        }

      } else if (job.tipo === 'recalcular_score_lote') {
        const { cliente_id } = job.payload as { cliente_id: string };
        if (!cliente_id) throw new Error('payload inválido: cliente_id ausente');

        const { data: imoveis, error: imErr } = await supabase
          .from('imoveis')
          .select('id')
          .eq('cliente_id', cliente_id)
          .is('deleted_at', null)
          .limit(1000);

        if (imErr) throw imErr;

        for (const im of (imoveis ?? [])) {
          const { error } = await supabase.rpc('fn_calcular_score_imovel', {
            p_imovel_id: im.id,
            p_cliente_id: cliente_id,
          });
          if (error) console.error(`Erro ao calcular score do imóvel ${im.id}:`, error.message);
        }
      }

      await supabase
        .from('job_queue')
        .update({
          status: 'concluido',
          concluido_em: new Date().toISOString(),
          resultado: { processado: true },
        })
        .eq('id', job.id);

      processados++;

    } catch (err) {
      const tentativas = (job.tentativas ?? 0) + 1;
      const maxTentativas = job.max_tentativas ?? 3;
      const falhou = tentativas >= maxTentativas;

      await supabase
        .from('job_queue')
        .update({
          status: falhou ? 'falhou' : 'pendente',
          tentativas,
          erro: (err as Error).message,
          executar_em: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        })
        .eq('id', job.id);

      console.error(`Job ${job.id} falhou (tentativa ${tentativas}/${maxTentativas}):`, (err as Error).message);
      erros++;
    }
  }

  return new Response(
    JSON.stringify({ processados, erros, total: jobs.length }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
});
