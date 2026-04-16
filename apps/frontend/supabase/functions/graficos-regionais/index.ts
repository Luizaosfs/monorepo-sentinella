/**
 * Edge Function: graficos-regionais
 * Usa Claude Haiku com tool_use para gerar specs de gráficos a partir dos dados regionais.
 *
 * Auth: analista_regional ou admin (JWT obrigatório).
 * Retorna: { graficos: GraficoSpec[], resumo: string, gerado_em: string }
 */

// v2
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const ALLOWED_ORIGINS = [
  Deno.env.get('APP_ORIGIN') ?? 'https://app.sentinella.com.br',
  'https://sentinellamap.com.br',
  'https://app.sentinella.com.br',
];

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? '';
  const allowed =
    ALLOWED_ORIGINS.includes(origin) ||
    origin.startsWith('http://localhost:') ||
    origin.startsWith('http://127.0.0.1:');
  return {
    'Access-Control-Allow-Origin': allowed ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type, x-supabase-api-version, prefer',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
  };
}

function json(body: unknown, status = 200, req?: Request) {
  const corsHeaders = req ? getCorsHeaders(req) : { 'Access-Control-Allow-Origin': ALLOWED_ORIGINS[0] };
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

// Paleta de cores Sentinella
const CORES = ['#7c3aed', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16'];

const TOOL_DEFINITION = {
  name: 'gerar_graficos_regionais',
  description: 'Gera especificações de gráficos para visualização dos dados regionais de vigilância epidemiológica. Escolha os gráficos mais reveladores com base nos dados.',
  input_schema: {
    type: 'object',
    properties: {
      resumo: {
        type: 'string',
        description: 'Insight principal de 1-2 frases sobre o que os dados revelam visualmente.',
      },
      graficos: {
        type: 'array',
        minItems: 2,
        maxItems: 6,
        description: 'Lista de gráficos. Escolha tipos e dados que melhor contam a história dos dados.',
        items: {
          type: 'object',
          required: ['titulo', 'tipo', 'dados'],
          properties: {
            titulo: { type: 'string', description: 'Título curto do gráfico.' },
            tipo: {
              type: 'string',
              enum: ['bar', 'bar_horizontal', 'pie', 'line', 'area'],
              description: 'bar=barras verticais, bar_horizontal=barras horizontais (bom para rankings), pie=pizza, line=linha temporal, area=área',
            },
            descricao: { type: 'string', description: 'Frase curta explicando o que o gráfico mostra.' },
            dados: {
              type: 'array',
              items: {
                type: 'object',
                required: ['nome', 'valor'],
                properties: {
                  nome: { type: 'string' },
                  valor: { type: 'number' },
                  valor2: { type: 'number', description: 'Segunda métrica opcional (para gráficos comparativos).' },
                  label2: { type: 'string', description: 'Nome da segunda métrica.' },
                },
              },
            },
            cor_primaria: {
              type: 'string',
              description: 'Cor hex principal. Use: vermelho=#ef4444 para problemas, verde=#10b981 para bom desempenho, violeta=#7c3aed para neutro.',
            },
            unidade: { type: 'string', description: 'Ex: "focos", "%", "horas". Aparece nos tooltips.' },
          },
        },
      },
    },
    required: ['resumo', 'graficos'],
  },
};

const SYSTEM_PROMPT = `Você é um especialista em visualização de dados epidemiológicos.
Analise os dados regionais fornecidos e use a ferramenta gerar_graficos_regionais para criar
visualizações que revelem insights estratégicos.

DIRETRIZES DE VISUALIZAÇÃO:
- Prefira bar_horizontal para rankings de municípios (mais legível)
- Use pie apenas quando houver 2-5 categorias claras
- Use cores vermelhas (#ef4444) para dados críticos (SLA vencido, focos altos)
- Use cores verdes (#10b981) para indicadores positivos (taxa de resolução alta)
- Use violeta (#7c3aed) para métricas neutras
- Sempre inclua dados reais dos municípios fornecidos — nunca invente valores
- Crie entre 3 e 5 gráficos que juntos contem uma história coerente
- Priorize: comparativo entre municípios, distribuição de SLA, performance operacional`;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: getCorsHeaders(req) });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, req);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!anthropicKey) return json({ error: 'ANTHROPIC_API_KEY não configurada' }, 500, req);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Não autorizado' }, 401, req);

  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authErr } = await authClient.auth.getUser();
  if (authErr || !user) return json({ error: 'Não autorizado' }, 401, req);

  const { data: papelRow } = await authClient
    .from('papeis_usuarios')
    .select('papel')
    .eq('usuario_id', user.id)
    .maybeSingle();
  const papel = papelRow?.papel;
  if (papel !== 'analista_regional' && papel !== 'admin') {
    return json({ error: 'Acesso restrito a analista_regional e admin' }, 403, req);
  }

  const [kpiRes, slaRes, usoRes] = await Promise.all([
    authClient.from('v_regional_kpi_municipio').select('*').order('total_focos', { ascending: false }),
    authClient.from('v_regional_sla_municipio').select('*'),
    authClient.from('v_regional_uso_sistema').select('*'),
  ]);

  if (kpiRes.error) return json({ error: 'Erro ao carregar KPIs regionais' }, 500, req);
  const kpi = kpiRes.data ?? [];
  const sla = slaRes.data ?? [];
  const uso = usoRes.data ?? [];

  if (kpi.length === 0) return json({ error: 'Sem municípios vinculados ao agrupamento' }, 404, req);

  const usoMap = new Map(uso.map((u: Record<string, unknown>) => [u.cliente_id, u]));
  const slaMap = new Map(sla.map((s: Record<string, unknown>) => [s.cliente_id, s]));

  const totalFocos = kpi.reduce((s: number, r: Record<string, unknown>) => s + Number(r.total_focos ?? 0), 0);
  const totalResolvidos = kpi.reduce((s: number, r: Record<string, unknown>) => s + Number(r.focos_resolvidos ?? 0), 0);
  const totalSlaVencido = kpi.reduce((s: number, r: Record<string, unknown>) => s + Number(r.sla_vencido_count ?? 0), 0);
  const taxaMedia = kpi.length
    ? kpi.reduce((s: number, r: Record<string, unknown>) => s + Number(r.taxa_resolucao_pct ?? 0), 0) / kpi.length
    : 0;

  const municipiosData = kpi.map((r: Record<string, unknown>) => {
    const u = usoMap.get(r.cliente_id as string) as Record<string, unknown> | undefined;
    const s = slaMap.get(r.cliente_id as string) as Record<string, unknown> | undefined;
    return `  - ${r.municipio_nome} (${r.uf ?? '?'}): focos_totais=${r.total_focos}, focos_ativos=${r.focos_ativos}, `
      + `taxa_resolucao=${Number(r.taxa_resolucao_pct ?? 0).toFixed(1)}%, `
      + `sla_vencido=${r.sla_vencido_count}, sla_ok=${s?.sla_ok ?? 0}, sla_atencao=${s?.sla_atencao ?? 0}, `
      + `sla_critico=${s?.sla_critico ?? 0}, eventos_7d=${u?.eventos_7d ?? 0}, `
      + `tempo_medio_resolucao_h=${r.tempo_medio_resolucao_horas ? Number(r.tempo_medio_resolucao_horas).toFixed(0) : 'N/A'}`;
  }).join('\n');

  const userPrompt = `DADOS REGIONAIS — ${new Date().toLocaleDateString('pt-BR')}

RESUMO:
- Municípios: ${kpi.length}
- Focos totais: ${totalFocos} | Resolvidos: ${totalResolvidos}
- Taxa média resolução: ${taxaMedia.toFixed(1)}%
- SLA vencido regional: ${totalSlaVencido}

POR MUNICÍPIO:
${municipiosData}

Analise os dados e gere os gráficos mais relevantes usando a ferramenta disponível.`;

  const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': anthropicKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      tools: [TOOL_DEFINITION],
      tool_choice: { type: 'tool', name: 'gerar_graficos_regionais' },
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });

  if (!anthropicRes.ok) {
    const err = await anthropicRes.text();
    console.error('Anthropic error:', err);
    let detail: unknown;
    try { detail = JSON.parse(err); } catch { detail = err; }
    return json({ error: 'Erro ao gerar gráficos com IA', detail }, 502, req);
  }

  const anthropicData = await anthropicRes.json() as {
    content: Array<{ type: string; id?: string; name?: string; input?: unknown }>;
    usage: { input_tokens: number; output_tokens: number };
  };

  const toolUse = anthropicData.content?.find(b => b.type === 'tool_use' && b.name === 'gerar_graficos_regionais');
  if (!toolUse?.input) {
    return json({ error: 'IA não retornou especificações de gráficos' }, 502, req);
  }

  const input = toolUse.input as { resumo: string; graficos: unknown[] };

  // Garante cores para dados sem cor definida
  const graficosComCores = input.graficos.map((g: unknown) => {
    const grafico = g as Record<string, unknown>;
    const dados = (grafico.dados as Array<Record<string, unknown>>).map((d, i) => ({
      ...d,
      cor: d.cor ?? CORES[i % CORES.length],
    }));
    return { ...grafico, dados, cor_primaria: grafico.cor_primaria ?? CORES[0] };
  });

  return json({
    resumo: input.resumo,
    graficos: graficosComCores,
    municipios: kpi.length,
    tokens_entrada: anthropicData.usage.input_tokens,
    tokens_saida: anthropicData.usage.output_tokens,
    gerado_em: new Date().toISOString(),
  }, 200, req);
});
