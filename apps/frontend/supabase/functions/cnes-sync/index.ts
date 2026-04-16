import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

// ── CORS ─────────────────────────────────────────────────────────────────────

const PRODUCTION_ORIGIN_CNES = Deno.env.get('APP_ORIGIN') ?? 'https://app.sentinella.com.br';
const ALLOWED_ORIGINS_CNES = new Set([
  PRODUCTION_ORIGIN_CNES,
  'http://localhost:8080',
  'http://localhost:5173',
  'http://localhost:3000',
]);

function getCorsHeaders(requestOrigin: string | null) {
  const origin = requestOrigin && ALLOWED_ORIGINS_CNES.has(requestOrigin)
    ? requestOrigin
    : PRODUCTION_ORIGIN_CNES;
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
}

function json(body: unknown, status = 200, cors: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors },
  });
}

// ── Mapeamento de tipos CNES → tipo_sentinela ────────────────────────────────

const MAPEAMENTO_TIPO: Record<string, string> = {
  '01': 'UBS', '02': 'UBS', '40': 'UBS',
  '43': 'USF',
  '05': 'CEM', '36': 'CEM',
  '70': 'HOSPITAL', '71': 'HOSPITAL', '72': 'HOSPITAL', '73': 'HOSPITAL', '62': 'HOSPITAL',
  '07': 'UPA', '68': 'UPA',
  '15': 'VIGILANCIA', '21': 'VIGILANCIA',
};

const TIPO_SENTINELA_TO_TIPO: Record<string, string> = {
  UBS: 'ubs', USF: 'ubs', UPA: 'upa', HOSPITAL: 'hospital',
  CEM: 'outro', VIGILANCIA: 'outro', OUTRO: 'outro',
};

// Tipos que serão persistidos (OUTRO = não mapeado = ignorar)
const TIPOS_SENTINELA_VALIDOS = new Set(['UBS', 'USF', 'UPA', 'HOSPITAL', 'CEM', 'VIGILANCIA']);

// ── Normalização defensiva ───────────────────────────────────────────────────

function pick(...candidates: unknown[]): string | null {
  for (const c of candidates) {
    if (c && typeof c === 'string' && c.trim()) return c.trim();
  }
  return null;
}

function pickNum(...candidates: unknown[]): number | null {
  for (const c of candidates) {
    const n = typeof c === 'string' ? parseFloat(c) : typeof c === 'number' ? c : NaN;
    if (!isNaN(n) && n !== 0) return n;
  }
  return null;
}

interface EstabelecimentoCNES {
  cnes: string;
  nome: string;
  tipo_sentinela: string;
  tipo: string;
  endereco: string | null;
  bairro: string | null;
  municipio: string | null;
  uf: string | null;
  telefone: string | null;
  latitude: number | null;
  longitude: number | null;
}

// Normalização para campos DATASUS maiúsculos (padrão ElastiCNES)
function normalizarEstabelecimentoElastic(
  raw: Record<string, unknown>
): EstabelecimentoCNES | null {
  const cnes = pick(
    raw.CO_CNES, raw.CNES, raw.co_cnes, raw.cnes, raw.noCnes,
  );
  if (!cnes) return null;

  const coTipoRaw = pick(
    raw.TP_PFPJ,
    raw.CO_TIPO_UNIDADE,
    raw.tp_unidade,
    raw.tipoUnidade,
  );
  // Garantir 2 dígitos com zero à esquerda (ex: "1" → "01")
  const coTipo = coTipoRaw ? String(coTipoRaw).padStart(2, '0') : null;
  const tipo_sentinela = (coTipo && MAPEAMENTO_TIPO[coTipo]) || 'OUTRO';
  const tipo = TIPO_SENTINELA_TO_TIPO[tipo_sentinela] || 'outro';

  const logradouro = pick(raw.DS_LOGRADOURO, raw.NO_LOGRADOURO, raw.noLogradouro, raw.logradouro);
  const numero     = pick(raw.NU_ENDERECO,   raw.nuEndereco,   raw.numero);
  const endereco   = [logradouro, numero].filter(Boolean).join(', ') || null;

  return {
    cnes: String(cnes),
    nome: pick(
      raw.NO_FANTASIA,   raw.DS_RAZAO_SOCIAL,
      raw.noFantasia,    raw.noRazaoSocial,
      raw.dsRazaoSocial, raw.nome,
    ) || `Estabelecimento ${cnes}`,
    tipo_sentinela,
    tipo,
    endereco,
    bairro:    pick(raw.NO_BAIRRO,    raw.noBairro,   raw.bairro),
    municipio: pick(raw.NO_MUNICIPIO, raw.noMunicipio, raw.municipio),
    uf:        pick(raw.SG_UF,        raw.sgUf,       raw.coUf, raw.uf),
    telefone:  pick(raw.NU_TELEFONE,  raw.nuTelefone, raw.telefone),
    latitude:  pickNum(raw.NU_LATITUDE,  raw.nulat,  raw.latitude, raw.lat),
    longitude: pickNum(raw.NU_LONGITUDE, raw.nulng,  raw.longitude, raw.lng),
  };
}

// ── ElastiCNES ───────────────────────────────────────────────────────────────

const ELASTICNES_BASE = 'https://elasticnes.saude.gov.br';

const CANDIDATOS_INDICE = [
  'cnes_estabelecimentos',
  'cnes-estabelecimentos',
  'estabelecimentos',
];

const CANDIDATOS_CAMPO_IBGE = [
  'municipio_codigo',
  'CO_MUNICIPIO_GESTOR',
  'co_municipio',
  'municipioCodigo',
  'ibge',
];

async function fetchElastic(
  path: string,
  method: 'GET' | 'POST',
  body?: unknown,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    return await fetch(`${ELASTICNES_BASE}/elasticsearch${path}`, {
      method,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function descobrirIndice(): Promise<string> {
  for (const indice of CANDIDATOS_INDICE) {
    try {
      const resp = await fetchElastic(`/${indice}/_count`, 'GET');
      if (resp.ok) {
        console.log(`[cnes-sync] índice ElastiCNES encontrado: ${indice}`);
        return indice;
      }
    } catch { /* tenta próximo */ }
  }
  throw new Error('ElastiCNES: nenhum índice de estabelecimentos encontrado');
}

async function descobrirCampoIbge(indice: string): Promise<string> {
  const resp = await fetchElastic(`/${indice}/_mapping`, 'GET');
  if (!resp.ok) {
    throw new Error(`ElastiCNES: falha ao buscar mapeamento (${resp.status})`);
  }
  const body = await resp.json();
  const properties: Record<string, unknown> =
    (body[indice]?.mappings?.properties) ??
    (Object.values(body)[0] as { mappings?: { properties?: Record<string, unknown> } })?.mappings?.properties ??
    {};

  for (const candidato of CANDIDATOS_CAMPO_IBGE) {
    if (properties[candidato]) {
      console.log(`[cnes-sync] campo IBGE encontrado: ${candidato}`);
      return candidato;
    }
  }

  // Busca parcial pelo nome do campo
  const campo = Object.keys(properties).find(
    (k) => k.toLowerCase().includes('municipio') && k.toLowerCase().includes('cod')
  );
  if (campo) {
    console.log(`[cnes-sync] campo IBGE (match parcial): ${campo}`);
    return campo;
  }

  const amostraCampos = Object.keys(properties).slice(0, 30).join(', ');
  throw new Error(`ElastiCNES: campo de código IBGE não encontrado. Campos disponíveis: ${amostraCampos}`);
}

async function buscarComPaginacao(
  indice: string,
  campoIbge: string,
  ibge6: string,
): Promise<Record<string, unknown>[]> {
  const PAGE_SIZE = 500;
  const MAX_PAGES = 10;
  const resultado: Record<string, unknown>[] = [];

  for (let page = 0; page < MAX_PAGES; page++) {
    const query = {
      from: page * PAGE_SIZE,
      size: PAGE_SIZE,
      query: {
        bool: {
          must: [{ term: { [campoIbge]: ibge6 } }],
        },
      },
      _source: true,
    };

    const resp = await fetchElastic(`/${indice}/_search`, 'POST', query);
    if (!resp.ok) {
      const txt = await resp.text();
      throw new Error(`ElastiCNES: busca falhou (${resp.status}): ${txt.slice(0, 300)}`);
    }

    const body = await resp.json();
    const hits: Record<string, unknown>[] = (body?.hits?.hits ?? []).map(
      (h: { _source: Record<string, unknown> }) => h._source,
    );

    resultado.push(...hits);
    console.log(`[cnes-sync] ElastiCNES página ${page + 1}: ${hits.length} registros (total: ${resultado.length})`);

    if (hits.length < PAGE_SIZE) break;
  }

  return resultado;
}

async function buscarEstabelecimentosCNES(
  uf: string,
  ibge: string,
): Promise<EstabelecimentoCNES[]> {
  const ibge6 = ibge.length === 7 ? ibge.slice(0, 6) : ibge;
  console.log(`[cnes-sync] buscando via ElastiCNES — UF=${uf} IBGE=${ibge6}`);

  const indice    = await descobrirIndice();
  const campoIbge = await descobrirCampoIbge(indice);
  const raw       = await buscarComPaginacao(indice, campoIbge, ibge6);

  // Log diagnóstico removido — evitar exposição de estrutura da API CNES em logs

  const normalizado = raw
    .map((doc) => normalizarEstabelecimentoElastic(doc))
    .filter((e): e is EstabelecimentoCNES => e !== null)
    .filter((e) => TIPOS_SENTINELA_VALIDOS.has(e.tipo_sentinela));

  console.log(`[cnes-sync] ElastiCNES → ${raw.length} brutos → ${normalizado.length} após filtro de tipos`);
  return normalizado;
}

// ── Sincronização com controle já criado ─────────────────────────────────────

async function executarSincronizacaoComControle(
  supabase: ReturnType<typeof createClient>,
  cliente: { id: string; uf: string; ibge_municipio: string },
  controleId: string,
): Promise<void> {
  const log = async (cnes: string | null, acao: string, mensagem?: string) => {
    await supabase.from('unidades_saude_sync_log').insert({
      controle_id: controleId,
      cliente_id: cliente.id,
      cnes,
      acao,
      mensagem: mensagem ?? null,
    });
  };

  let totalRecebidos = 0;
  let totalInseridos = 0;
  let totalAtualizados = 0;
  let totalInativados = 0;

  try {
    const estabelecimentos = await buscarEstabelecimentosCNES(cliente.uf, cliente.ibge_municipio);
    totalRecebidos = estabelecimentos.length;

    if (totalRecebidos === 0) {
      const ibge6 = cliente.ibge_municipio.length === 7 ? cliente.ibge_municipio.slice(0, 6) : cliente.ibge_municipio;
      throw new Error(`ElastiCNES retornou 0 estabelecimentos válidos para UF=${cliente.uf} IBGE=${ibge6}`);
    }

    const { data: existentes } = await supabase
      .from('unidades_saude')
      .select('id, cnes, latitude, longitude, endereco')
      .eq('cliente_id', cliente.id)
      .eq('origem', 'cnes_sync')
      .not('cnes', 'is', null);

    const existentesByCnes = new Map(
      (existentes || []).map((u) => [u.cnes, u])
    );
    const cnesRecebidos = new Set(estabelecimentos.map((e) => e.cnes));

    for (const est of estabelecimentos) {
      const existing = existentesByCnes.get(est.cnes);
      // Preservar coordenadas manuais se ElastiCNES não retornar
      const latitude  = est.latitude  ?? (existing?.latitude  ?? null);
      const longitude = est.longitude ?? (existing?.longitude ?? null);
      const endereco  = est.endereco  ?? (existing?.endereco  ?? null);

      const payload = {
        cliente_id:     cliente.id,
        cnes:           est.cnes,
        nome:           est.nome,
        tipo:           est.tipo as 'ubs' | 'upa' | 'hospital' | 'outro',
        tipo_sentinela: est.tipo_sentinela,
        endereco,
        bairro:         est.bairro,
        municipio:      est.municipio,
        uf:             est.uf,
        telefone:       est.telefone,
        latitude,
        longitude,
        origem:         'cnes_sync',
        ativo:          true,
        ultima_sync_em: new Date().toISOString(),
      };

      const { error: upsertErr } = await supabase
        .from('unidades_saude')
        .upsert(payload, { onConflict: 'cliente_id,cnes' });

      if (upsertErr) {
        await log(est.cnes, 'erro', upsertErr.message);
      } else {
        if (!existentesByCnes.has(est.cnes)) {
          totalInseridos++;
          await log(est.cnes, 'inserido', est.nome);
        } else {
          totalAtualizados++;
        }
      }
    }

    // Inativação suave: unidades cnes_sync ausentes na resposta
    const cnesParaInativar = [...existentesByCnes.keys()].filter((c) => !cnesRecebidos.has(c));
    for (const cnesInativo of cnesParaInativar) {
      const { error: inativarErr } = await supabase
        .from('unidades_saude')
        .update({ ativo: false })
        .eq('cliente_id', cliente.id)
        .eq('cnes', cnesInativo);

      if (!inativarErr) {
        totalInativados++;
        await log(cnesInativo, 'inativado', 'Não encontrado na resposta ElastiCNES mais recente');
      }
    }

    await supabase
      .from('unidades_saude_sync_controle')
      .update({
        status:           'sucesso',
        finalizado_em:    new Date().toISOString(),
        total_recebidos:  totalRecebidos,
        total_inseridos:  totalInseridos,
        total_atualizados: totalAtualizados,
        total_inativados:  totalInativados,
      })
      .eq('id', controleId);

    console.log(`[cnes-sync] cliente ${cliente.id}: sucesso — recebidos=${totalRecebidos} inseridos=${totalInseridos} atualizados=${totalAtualizados} inativados=${totalInativados}`);

  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`[cnes-sync] cliente ${cliente.id}: erro`, errMsg);

    await supabase
      .from('unidades_saude_sync_controle')
      .update({
        status:            'erro',
        finalizado_em:     new Date().toISOString(),
        total_recebidos:   totalRecebidos,
        total_inseridos:   totalInseridos,
        total_atualizados: totalAtualizados,
        total_inativados:  totalInativados,
        erro_mensagem:     errMsg,
      })
      .eq('id', controleId);

    await log(null, 'erro', errMsg);
  }
}

// ── Handler principal ────────────────────────────────────────────────────────

serve(async (req) => {
  const cors = getCorsHeaders(req.headers.get('origin'));
  const j = (body: unknown, status = 200) => json(body, status, cors);

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase    = createClient(supabaseUrl, serviceKey);

  let body: { origem?: string; cliente_id?: string; usuario_id?: string } = {};
  try {
    body = await req.json();
  } catch {
    // body pode ser vazio para chamadas cron
  }

  const origem = (body.origem === 'manual' ? 'manual' : 'agendado') as 'agendado' | 'manual';

  // Autenticação: manual exige Bearer token (validado adiante via usuario_pode_acessar_cliente);
  // agendado exige CRON_SECRET. Rejeita se nenhum dos dois estiver presente.
  const cronSecret  = req.headers.get('x-cron-secret');
  const authHeader  = req.headers.get('Authorization') ?? '';
  const hasCronSecret = cronSecret === Deno.env.get('CRON_SECRET') && !!Deno.env.get('CRON_SECRET');
  const hasBearerToken = authHeader.startsWith('Bearer ') && authHeader.length > 20;

  if (!hasCronSecret && !hasBearerToken) {
    return j({ error: 'Não autorizado' }, 401);
  }
  // Modo agendado acionado por cron: CRON_SECRET é suficiente.
  // Modo manual acionado por usuário: Bearer token será validado abaixo no bloco manual.

  try {
    if (origem === 'manual') {
      if (!body.cliente_id) {
        return j({ error: 'cliente_id obrigatório para sync manual' }, 400);
      }

      // Validar JWT — só o usuário com acesso ao cliente pode disparar sync manual
      const authHeader = req.headers.get('Authorization') ?? '';
      const token = authHeader.replace(/^Bearer\s+/i, '').trim();
      if (!token) {
        return j({ error: 'Token de autenticação ausente' }, 401);
      }
      const supabaseUser = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_ANON_KEY')!,
        { global: { headers: { Authorization: `Bearer ${token}` } } },
      );
      const { data: temAcesso } = await supabaseUser.rpc('usuario_pode_acessar_cliente', {
        p_cliente_id: body.cliente_id,
      });
      if (!temAcesso) {
        return j({ error: 'Acesso negado ao cliente informado' }, 403);
      }

      const { data: cliente, error: cErr } = await supabase
        .from('clientes')
        .select('id, uf, ibge_municipio')
        .eq('id', body.cliente_id)
        .single();

      if (cErr || !cliente) {
        return j({ error: 'Cliente não encontrado' }, 404);
      }

      if (!cliente.uf || !cliente.ibge_municipio) {
        return j({
          error: 'Cliente sem UF ou código IBGE configurados. Configure antes de sincronizar.',
        }, 422);
      }

      const { data: emAndamento } = await supabase
        .from('unidades_saude_sync_controle')
        .select('id')
        .eq('cliente_id', cliente.id)
        .eq('status', 'em_andamento')
        .limit(1);

      if (emAndamento && emAndamento.length > 0) {
        return j({ status: 'concorrencia', message: 'Sincronização já em andamento para este cliente.' });
      }

      const { data: controle, error: controleErr } = await supabase
        .from('unidades_saude_sync_controle')
        .insert({
          cliente_id:       cliente.id,
          status:           'em_andamento',
          origem_execucao:  'manual',
          usuario_id:       body.usuario_id ?? null,
        })
        .select()
        .single();

      if (controleErr || !controle) {
        return j({ error: 'Erro ao registrar sincronização' }, 500);
      }

      const syncPromise = executarSincronizacaoComControle(
        supabase,
        cliente as { id: string; uf: string; ibge_municipio: string },
        controle.id,
      ).catch(console.error);

      // Usa EdgeRuntime.waitUntil se disponível (Supabase Edge)
      const er = (globalThis as typeof globalThis & {
        EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void };
      }).EdgeRuntime;
      if (er?.waitUntil) er.waitUntil(syncPromise);

      return j({ status: 'iniciado', controle_id: controle.id, message: 'Sincronização iniciada.' }, 202);

    } else {
      // Sincronização agendada
      const { data: clientes, error: listErr } = await supabase
        .from('clientes')
        .select('id, uf, ibge_municipio')
        .eq('ativo', true)
        .not('uf', 'is', null)
        .not('ibge_municipio', 'is', null);

      if (listErr) throw listErr;

      let processados = 0;
      let erros = 0;

      for (const cliente of clientes || []) {
        if (!cliente.uf || !cliente.ibge_municipio) continue;

        const { data: emAndamento } = await supabase
          .from('unidades_saude_sync_controle')
          .select('id')
          .eq('cliente_id', cliente.id)
          .eq('status', 'em_andamento')
          .limit(1);

        if (emAndamento && emAndamento.length > 0) {
          console.log(`[cnes-sync] cliente ${cliente.id}: já em andamento, pulando.`);
          continue;
        }

        const { data: controle, error: controleErr } = await supabase
          .from('unidades_saude_sync_controle')
          .insert({
            cliente_id:      cliente.id,
            status:          'em_andamento',
            origem_execucao: 'agendado',
            usuario_id:      null,
          })
          .select()
          .single();

        if (controleErr || !controle) {
          erros++;
          continue;
        }

        try {
          await executarSincronizacaoComControle(
            supabase,
            cliente as { id: string; uf: string; ibge_municipio: string },
            controle.id,
          );
          processados++;
        } catch (err) {
          erros++;
          console.error(`[cnes-sync] falha no cliente ${cliente.id}:`, err);
        }
      }

      return j({ status: 'concluido', processados, erros });
    }

  } catch (err) {
    console.error('[cnes-sync] erro geral:', err);
    return j({ error: err instanceof Error ? err.message : 'Erro interno' }, 500);
  }
});
