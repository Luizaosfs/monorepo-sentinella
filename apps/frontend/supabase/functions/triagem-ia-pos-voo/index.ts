/**
 * triagem-ia-pos-voo
 *
 * Edge Function que processa os itens de um levantamento pós-voo:
 * 1. Agrupa focos por proximidade geográfica (cluster simples por grade 0.001°)
 * 2. Filtra falsos positivos já marcados na tabela yolo_feedback
 * 3. Gera um sumário executivo via Claude (claude-haiku-4-5-20251001)
 * 4. Persiste o resultado em levantamento_analise_ia
 *
 * Body esperado: { levantamento_id: string, cliente_id: string }
 *
 * Segredos necessários: ANTHROPIC_API_KEY
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const APP_ORIGIN = Deno.env.get('APP_ORIGIN');
if (!APP_ORIGIN) {
  console.warn('[triagem-ia-pos-voo] APP_ORIGIN não configurada — usando fallback restritivo');
}
const ALLOWED_ORIGIN = APP_ORIGIN ?? 'https://app.sentinella.com.br';
const CORS = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LevantamentoItemRow {
  id: string;
  item: string | null;
  risco: string | null;
  prioridade: string | null;
  endereco_curto: string | null;
  latitude: number | null;
  longitude: number | null;
  score_final: number | null;
}

interface Cluster {
  id: string;
  centroide: [number, number];
  total_focos: number;
  focos: Array<{ id: string; item: string | null; risco: string | null; endereco: string | null }>;
  risco_predominante: string;
}

function normalizeScore(raw: number | null): number | null {
  if (raw == null) return null;
  return raw > 1 ? raw / 100 : raw;
}

/** Agrupa itens por célula de 0.001° (~100 m de resolução). */
function clusterByGrid(items: LevantamentoItemRow[], gridSize = 0.001): Cluster[] {
  const cells = new Map<string, LevantamentoItemRow[]>();
  for (const it of items) {
    if (it.latitude == null || it.longitude == null) continue;
    const cellKey = `${Math.round(it.latitude / gridSize)},${Math.round(it.longitude / gridSize)}`;
    if (!cells.has(cellKey)) cells.set(cellKey, []);
    cells.get(cellKey)!.push(it);
  }

  const clusters: Cluster[] = [];
  let idx = 0;
  for (const [, group] of cells) {
    const lats = group.map((g) => g.latitude!);
    const lngs = group.map((g) => g.longitude!);
    const centroide: [number, number] = [
      lats.reduce((a, b) => a + b, 0) / lats.length,
      lngs.reduce((a, b) => a + b, 0) / lngs.length,
    ];
    const riscos = group.map((g) => g.risco?.toLowerCase() ?? '').filter(Boolean);
    const riscoPred = riscos.includes('crítico') || riscos.includes('critico') ? 'Crítico'
      : riscos.includes('alto') ? 'Alto'
      : riscos.includes('moderado') ? 'Moderado'
      : riscos.includes('baixo') ? 'Baixo' : 'Indefinido';

    clusters.push({
      id: `cluster-${++idx}`,
      centroide,
      total_focos: group.length,
      focos: group.map((g) => ({ id: g.id, item: g.item, risco: g.risco, endereco: g.endereco_curto })),
      risco_predominante: riscoPred,
    });
  }

  return clusters.sort((a, b) => b.total_focos - a.total_focos);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  // ── Auth first — antes de qualquer validação de body ─────────────────────────
  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    return new Response(JSON.stringify({ error: 'Token de autenticação ausente' }), {
      status: 401, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
  {
    const supabaseCheck = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: `Bearer ${token}` } } },
    );
    const { data: { user }, error } = await supabaseCheck.auth.getUser();
    if (error || !user) {
      return new Response(JSON.stringify({ error: 'Sessão inválida ou expirada' }), {
        status: 401, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }
  }
  // ─────────────────────────────────────────────────────────────────────────────

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  let levantamentoId: string, clienteId: string, force: boolean;
  try {
    const body = await req.json();
    levantamentoId = body.levantamento_id;
    clienteId = body.cliente_id;
    force = body.force === true;
    if (!levantamentoId || !clienteId) throw new Error('Parâmetros obrigatórios ausentes');
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } });
  }

  // ── Validar acesso do usuário ao cliente específico ───────────────────────────
  {
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: `Bearer ${token}` } } },
    );
    const { data: temAcesso } = await supabaseUser.rpc('usuario_pode_acessar_cliente', {
      p_cliente_id: clienteId,
    });
    if (!temAcesso) {
      return new Response(JSON.stringify({ error: 'Acesso negado ao cliente informado' }), {
        status: 403, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }
  }
  // ─────────────────────────────────────────────────────────────────────────────

  // ── Idempotência: verificar se já existe análise recente ─────────────────────
  // Evita chamar Claude Haiku múltiplas vezes para o mesmo levantamento.
  // Permite reprocessamento explícito via force=true.
  if (!force) {
    const { data: analiseExistente } = await supabase
      .from('levantamento_analise_ia')
      .select('id, status, processado_em, sumario, total_focos, total_clusters, falsos_positivos, clusters, modelo, erro')
      .eq('levantamento_id', levantamentoId)
      .eq('cliente_id', clienteId)
      .eq('status', 'sucesso')
      .order('processado_em', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (analiseExistente) {
      return new Response(
        JSON.stringify({ ...analiseExistente, _cache: true }),
        { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } },
      );
    }

    // Bloquear reprocessamento se há análise pendente/em andamento nos últimos 30 min
    const trintaMinAtras = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data: analiseRecente } = await supabase
      .from('levantamento_analise_ia')
      .select('id, processado_em')
      .eq('levantamento_id', levantamentoId)
      .eq('cliente_id', clienteId)
      .gte('processado_em', trintaMinAtras)
      .limit(1)
      .maybeSingle();

    if (analiseRecente) {
      return new Response(
        JSON.stringify({ error: 'Triagem já processada recentemente. Aguarde 30 minutos ou use force=true.' }),
        { status: 429, headers: { ...CORS, 'Content-Type': 'application/json' } },
      );
    }
  }
  // ─────────────────────────────────────────────────────────────────────────────

  // ── QW-16 B1: Verificar quota de ia_calls_mes antes de chamar Claude ─────────
  {
    const { data: quota } = await supabase.rpc('cliente_verificar_quota', {
      p_cliente_id: clienteId,
      p_metrica: 'ia_calls_mes',
    });
    if (quota && !quota.ok) {
      return new Response(
        JSON.stringify({
          error: 'quota_ia_excedida',
          usado: quota.usado,
          limite: quota.limite,
          mensagem: 'Limite de triagens IA do mês atingido. Contate o administrador da plataforma.',
        }),
        { status: 402, headers: { ...CORS, 'Content-Type': 'application/json' } },
      );
    }
  }
  // ─────────────────────────────────────────────────────────────────────────────

  // 1. Buscar itens do levantamento
  const { data: itens, error: itensErr } = await supabase
    .from('levantamento_itens')
    .select('id, item, risco, prioridade, endereco_curto, latitude, longitude, score_final')
    .eq('levantamento_id', levantamentoId)
    .eq('cliente_id', clienteId);

  if (itensErr) return new Response(JSON.stringify({ error: itensErr.message }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } });

  const allItems = (itens ?? []) as LevantamentoItemRow[];

  // 2. Buscar IDs marcados como falso positivo
  const { data: feedbacks } = await supabase
    .from('yolo_feedback')
    .select('levantamento_item_id, confirmado')
    .eq('cliente_id', clienteId)
    .in('levantamento_item_id', allItems.map((i) => i.id));

  const falsoPositivoIds = new Set(
    (feedbacks ?? []).filter((f: { confirmado: boolean }) => !f.confirmado).map((f: { levantamento_item_id: string }) => f.levantamento_item_id),
  );

  const itensValidos = allItems.filter((i) => !falsoPositivoIds.has(i.id));
  const totalFalsos = falsoPositivoIds.size;

  // 3. Agrupar por cluster geográfico
  const clusters = clusterByGrid(itensValidos);
  const totalFocos = itensValidos.length;
  const totalClusters = clusters.length;

  // 4. Montar prompt para Claude
  const resumoItens = clusters.slice(0, 20).map((c) => (
    `- Cluster ${c.id} (${c.total_focos} focos, risco ${c.risco_predominante}): ${c.focos.slice(0, 3).map((f) => f.item || 'foco').join(', ')}${c.focos.length > 3 ? '...' : ''}`
  )).join('\n');

  const prompt = `Você é um assistente de vigilância epidemiológica. Com base no levantamento de campo abaixo, gere um sumário executivo conciso (máximo 4 parágrafos) para o gestor da prefeitura.

Dados do levantamento:
- Total de focos identificados (após filtro): ${totalFocos}
- Total de clusters geográficos: ${totalClusters}
- Falsos positivos descartados: ${totalFalsos}

Principais clusters:
${resumoItens || 'Nenhum foco com coordenadas válidas.'}

Instruções:
1. Aponte os clusters de maior risco e sua localização aproximada.
2. Sugira prioridade de atendimento.
3. Mencione se há padrão de recorrência visível.
4. Use linguagem objetiva e técnica, adequada a um relatório público.
5. Responda em português brasileiro.`;

  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
  let sumario = 'Sumário indisponível — configure ANTHROPIC_API_KEY.';
  // QW-09: rastrear se a IA gerou sumário real ou usou fallback
  let statusTriagem: 'sucesso' | 'falha' | 'sem_resultado' = 'sem_resultado';
  let erroTriagem: string | null = null;

  if (anthropicKey) {
    try {
      const claudeAbort = new AbortController();
      const claudeTimeout = setTimeout(() => claudeAbort.abort(), 25_000);
      const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        signal: claudeAbort.signal,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 512,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      clearTimeout(claudeTimeout);
      if (claudeRes.ok) {
        const claudeJson = await claudeRes.json();
        const texto = claudeJson.content?.[0]?.text;
        if (texto) {
          sumario = texto;
          statusTriagem = 'sucesso';
        } else {
          erroTriagem = 'Claude retornou resposta sem conteúdo de texto';
        }
      } else {
        const errBody = await claudeRes.text().catch(() => '');
        erroTriagem = `Claude HTTP ${claudeRes.status}: ${errBody.slice(0, 200)}`;
        statusTriagem = 'falha';
        console.error('[triagem-ia] Claude API falhou:', claudeRes.status, errBody.slice(0, 200));
      }
    } catch (e) {
      erroTriagem = e instanceof Error ? e.message : String(e);
      statusTriagem = 'falha';
      console.error('[triagem-ia] Erro ao chamar Claude:', erroTriagem);
    }
  }

  // 5. Persistir resultado com status de rastreabilidade (QW-09)
  const { data: analise, error: insertErr } = await supabase
    .from('levantamento_analise_ia')
    .insert({
      levantamento_id:  levantamentoId,
      cliente_id:       clienteId,
      modelo:           'claude-haiku-4-5-20251001',
      total_focos:      totalFocos,
      total_clusters:   totalClusters,
      falsos_positivos: totalFalsos,
      sumario,
      clusters:         clusters as unknown as Record<string, unknown>[],
      status:           statusTriagem,
      erro:             erroTriagem,
      processado_em:    new Date().toISOString(),
    })
    .select()
    .single();

  if (insertErr) return new Response(JSON.stringify({ error: insertErr.message }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } });

  return new Response(JSON.stringify(analise), {
    status: 200,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
});
