/**
 * billing-snapshot — QW-15
 *
 * Cron: 1º dia de cada mês às 04:00 UTC
 * - Fecha o billing_ciclo do mês anterior (status: aberto → fechado)
 * - Gera billing_usage_snapshot imutável para cada cliente
 * - Abre novo billing_ciclo para o mês corrente
 *
 * Pode ser chamado manualmente com POST { force_cliente_id?: string }
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const CORS = {
  'Access-Control-Allow-Origin': (() => {
    const o = Deno.env.get('APP_ORIGIN');
    if (!o) console.warn('[billing-snapshot] APP_ORIGIN não configurada — usando fallback restritivo');
    return o ?? 'https://app.sentinella.com.br';
  })(),
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  // Validação de CRON_SECRET — impede chamadas externas não autorizadas.
  // verify_jwt=false é necessário para execução agendada, mas o secret protege o endpoint.
  const cronSecret = req.headers.get('x-cron-secret');
  if (cronSecret !== Deno.env.get('CRON_SECRET')) {
    return new Response('Unauthorized', { status: 401, headers: CORS });
  }

  const sb = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
  const forceClienteId: string | null = body.force_cliente_id ?? null;

  const hoje = new Date();
  const anoMes = hoje.getUTCFullYear();
  const mesAtual = hoje.getUTCMonth(); // 0-based

  // Período que acabou de fechar (mês anterior)
  const inicioAnterior = new Date(Date.UTC(anoMes, mesAtual - 1, 1));
  const fimAnterior    = new Date(Date.UTC(anoMes, mesAtual, 0));   // último dia do mês anterior
  const inicioAtual    = new Date(Date.UTC(anoMes, mesAtual, 1));
  const fimAtual       = new Date(Date.UTC(anoMes, mesAtual + 1, 0));

  const fmt = (d: Date) => d.toISOString().slice(0, 10); // YYYY-MM-DD

  // Buscar clientes ativos (ou apenas o forçado)
  let clientesQuery = sb.from('clientes').select('id, nome').is('deleted_at', null);
  if (forceClienteId) clientesQuery = clientesQuery.eq('id', forceClienteId);
  const { data: clientes, error: clientesErr } = await clientesQuery;

  if (clientesErr || !clientes?.length) {
    return new Response(
      JSON.stringify({ error: clientesErr?.message ?? 'Nenhum cliente encontrado' }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } },
    );
  }

  const resultados: Array<{ cliente_id: string; ok: boolean; erro?: string }> = [];

  for (const cliente of clientes) {
    try {
      // 1. Calcular uso do mês anterior via RPC
      const { data: uso, error: usoErr } = await sb.rpc('calcular_uso_mensal', {
        p_cliente_id: cliente.id,
        p_inicio: fmt(inicioAnterior),
        p_fim: fmt(fimAnterior),
      });

      if (usoErr) throw new Error(usoErr.message);

      // 2. Buscar cliente_plano ativo
      const { data: planoRow } = await sb
        .from('cliente_plano')
        .select('id')
        .eq('cliente_id', cliente.id)
        .eq('status', 'ativo')
        .maybeSingle();

      // 3. Fechar billing_ciclo do mês anterior (se existir)
      const { data: cicloAnterior } = await sb
        .from('billing_ciclo')
        .select('id')
        .eq('cliente_id', cliente.id)
        .eq('periodo_inicio', fmt(inicioAnterior))
        .maybeSingle();

      if (cicloAnterior) {
        await sb
          .from('billing_ciclo')
          .update({ status: 'fechado', updated_at: new Date().toISOString() })
          .eq('id', cicloAnterior.id);
      }

      // 4. Upsert snapshot imutável do mês anterior
      await sb.from('billing_usage_snapshot').upsert({
        cliente_id:            cliente.id,
        billing_ciclo_id:      cicloAnterior?.id ?? null,
        periodo_inicio:        fmt(inicioAnterior),
        periodo_fim:           fmt(fimAnterior),
        vistorias_mes:         uso.vistorias_mes         ?? 0,
        levantamentos_mes:     uso.levantamentos_mes     ?? 0,
        itens_focos_mes:       uso.itens_focos_mes       ?? 0,
        voos_mes:              uso.voos_mes              ?? 0,
        denuncias_mes:         uso.denuncias_mes         ?? 0,
        ia_calls_mes:          uso.ia_calls_mes          ?? 0,
        relatorios_mes:        uso.relatorios_mes        ?? 0,
        syncs_cnes_mes:        uso.syncs_cnes_mes        ?? 0,
        notificacoes_esus_mes: uso.notificacoes_esus_mes ?? 0,
        usuarios_ativos_mes:   uso.usuarios_ativos_mes   ?? 0,
        imoveis_total:         uso.imoveis_total         ?? 0,
        storage_gb:            0, // Pendente: integrar Cloudinary Usage API (/usage) para medir storage real por pasta cliente_id. Por enquanto sempre 0.
        calculado_em:          new Date().toISOString(),
        payload_detalhado:     uso,
      }, { onConflict: 'cliente_id,periodo_inicio' });

      // 5. Abrir billing_ciclo para o mês atual (se não existir)
      await sb.from('billing_ciclo').upsert({
        cliente_id:       cliente.id,
        cliente_plano_id: planoRow?.id ?? null,
        periodo_inicio:   fmt(inicioAtual),
        periodo_fim:      fmt(fimAtual),
        status:           'aberto',
      }, { onConflict: 'cliente_id,periodo_inicio', ignoreDuplicates: true });

      resultados.push({ cliente_id: cliente.id, ok: true });
      console.log(`[billing-snapshot] cliente=${cliente.id} ok`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      resultados.push({ cliente_id: cliente.id, ok: false, erro: msg });
      console.error(`[billing-snapshot] cliente=${cliente.id} erro:`, msg);
    }
  }

  const ok    = resultados.filter((r) => r.ok).length;
  const falha = resultados.filter((r) => !r.ok).length;

  return new Response(
    JSON.stringify({ ok, falha, total: clientes.length, resultados }),
    { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } },
  );
});
