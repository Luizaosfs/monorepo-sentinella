/**
 * Edge Function: insights-regional
 * Gera análise narrativa regional via Claude Haiku para analista_regional (P5).
 *
 * Auth: analista_regional ou admin (JWT obrigatório).
 * Acesso: as views já filtram pelo agrupamento do usuário via RLS.
 * Sem cache — chamada sob demanda (baixa frequência).
 */

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

const SYSTEM_PROMPT = `Você é um especialista em vigilância epidemiológica regional.
Analise os dados de múltiplos municípios de uma região de saúde e gere um relatório estratégico.

REGRAS:
- Máximo 5 parágrafos curtos e objetivos
- Comece pelos pontos mais críticos (SLA vencido, municípios em risco)
- Compare o desempenho entre municípios quando relevante
- Identifique padrões regionais (ex: todos os municípios com SLA vencido crescente)
- Sugira ações práticas para o coordenador regional
- Use linguagem técnica mas acessível a gestores de saúde pública
- Nunca invente dados além dos fornecidos
- Destaque os municípios com melhor e pior desempenho`;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: getCorsHeaders(req) });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, req);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!anthropicKey) return json({ error: 'ANTHROPIC_API_KEY não configurada' }, 500, req);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Não autorizado' }, 401, req);

  // Valida JWT e obtém usuário
  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authErr } = await authClient.auth.getUser();
  if (authErr || !user) return json({ error: 'Não autorizado' }, 401, req);

  // Verifica papel (analista_regional ou admin)
  const { data: papelRow } = await authClient
    .from('papeis_usuarios')
    .select('papel')
    .eq('usuario_id', user.id)
    .maybeSingle();
  const papel = papelRow?.papel;
  if (papel !== 'analista_regional' && papel !== 'admin') {
    return json({ error: 'Acesso restrito a analista_regional e admin' }, 403, req);
  }

  // Consulta dados via views (RLS filtra pelo agrupamento do usuário automaticamente)
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

  // Mapa de uso e SLA por cliente_id
  const usoMap = new Map(uso.map((u: Record<string, unknown>) => [u.cliente_id, u]));
  const slaMap = new Map(sla.map((s: Record<string, unknown>) => [s.cliente_id, s]));

  // Monta contexto regional para o prompt
  const totalFocos = kpi.reduce((s: number, r: Record<string, unknown>) => s + Number(r.total_focos ?? 0), 0);
  const totalResolvidos = kpi.reduce((s: number, r: Record<string, unknown>) => s + Number(r.focos_resolvidos ?? 0), 0);
  const totalSlaVencido = kpi.reduce((s: number, r: Record<string, unknown>) => s + Number(r.sla_vencido_count ?? 0), 0);
  const taxaMedia = kpi.length
    ? kpi.reduce((s: number, r: Record<string, unknown>) => s + Number(r.taxa_resolucao_pct ?? 0), 0) / kpi.length
    : 0;

  const municipiosData = kpi.map((r: Record<string, unknown>) => {
    const u = usoMap.get(r.cliente_id as string) as Record<string, unknown> | undefined;
    const s = slaMap.get(r.cliente_id as string) as Record<string, unknown> | undefined;
    return `  - ${r.municipio_nome} (${r.uf ?? '?'}): ${r.total_focos} focos totais, ${r.focos_ativos} ativos, `
      + `taxa resolução ${Number(r.taxa_resolucao_pct ?? 0).toFixed(1)}%, `
      + `SLA vencido: ${r.sla_vencido_count}, `
      + `SLA ok/atenção/crítico/vencido: ${s?.sla_ok ?? 0}/${s?.sla_atencao ?? 0}/${s?.sla_critico ?? 0}/${s?.sla_vencido ?? 0}, `
      + `eventos últimos 7 dias: ${u?.eventos_7d ?? 0}, `
      + `tempo médio resolução: ${r.tempo_medio_resolucao_horas ? Number(r.tempo_medio_resolucao_horas).toFixed(0) + 'h' : 'sem dados'}`;
  }).join('\n');

  const userPrompt = `DADOS REGIONAIS — ${new Date().toLocaleDateString('pt-BR')}

RESUMO REGIONAL:
- Municípios monitorados: ${kpi.length}
- Total de focos registrados: ${totalFocos}
- Focos resolvidos: ${totalResolvidos}
- Taxa média de resolução: ${taxaMedia.toFixed(1)}%
- SLA vencido total na região: ${totalSlaVencido}

DADOS POR MUNICÍPIO:
${municipiosData}

Gere a análise regional estratégica com base nesses dados.`;

  // Chama Claude Haiku
  const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': anthropicKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });

  if (!anthropicRes.ok) {
    const err = await anthropicRes.text();
    console.error('Anthropic error:', err);
    let detail: unknown;
    try { detail = JSON.parse(err); } catch { detail = err; }
    return json({ error: 'Erro ao gerar insights com IA', detail }, 502, req);
  }

  const anthropicData = await anthropicRes.json() as {
    content: Array<{ type: string; text: string }>;
    usage: { input_tokens: number; output_tokens: number };
  };
  const texto = anthropicData.content?.[0]?.text ?? '';
  const tokens = anthropicData.usage;

  return json({
    insights: texto,
    municipios: kpi.length,
    tokens_entrada: tokens.input_tokens,
    tokens_saida: tokens.output_tokens,
    gerado_em: new Date().toISOString(),
  }, 200, req);
});
