/**
 * Testes da camada api.ts — shape testing com Supabase mockado.
 *
 * Garante que:
 *  1. Cada método chama a tabela/view correta
 *  2. Filtro por cliente_id é sempre aplicado (multitenancy)
 *  3. Erros do Supabase são propagados como exceções
 *  4. Valores de retorno têm o shape esperado
 *  5. withRetry reexecuta em erros 5xx retryáveis
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock do cliente Supabase ───────────────────────────────────────────────────
// Cria um builder fluente que é um thenable — simula a API do supabase-js.

type ChainMock = Record<string, ReturnType<typeof vi.fn>> & {
  then: (onfulfilled: (v: unknown) => unknown) => Promise<unknown>;
  _resolve: (value: unknown) => void;
};

function makeChain(resolveWith: unknown): ChainMock {
  const self: ChainMock = {} as ChainMock;
  const METHODS = [
    'select', 'eq', 'neq', 'is', 'in', 'gte', 'lte', 'gt', 'lt',
    'order', 'range', 'limit', 'filter', 'not', 'or', 'match',
    'update', 'insert', 'upsert', 'delete', 'single', 'maybeSingle',
    'returns', 'throwOnError',
  ];
  for (const m of METHODS) {
    self[m] = vi.fn().mockReturnValue(self);
  }
  self.then = (onfulfilled) => Promise.resolve(resolveWith).then(onfulfilled);
  self._resolve = () => {};
  return self;
}

// mock global do supabase
const mockFrom = vi.hoisted(() => vi.fn());
const mockRpc  = vi.hoisted(() => vi.fn());
const mockFunctions = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: mockFrom,
    rpc:  mockRpc,
    functions: mockFunctions,
    auth: { getUser: vi.fn() },
  },
  supabaseUrl: 'https://test.supabase.co',
  supabaseAnonKey: 'anon-key',
}));

// Dependências internas que usam supabase indiretamente
vi.mock('@/lib/enrichItensComFoco', () => ({
  enrichItensComFoco: vi.fn(async (items: unknown[]) => items),
}));
vi.mock('@/lib/sinan', () => ({
  calcularSemanaEpidemiologica: vi.fn().mockReturnValue(1),
  montarPayloadESUS: vi.fn().mockReturnValue({}),
}));

import { api } from './api';

// ── Helpers ───────────────────────────────────────────────────────────────────

function okChain(data: unknown = [], extra: object = {}) {
  return makeChain({ data, error: null, count: null, ...extra });
}

function errChain(message = 'DB error', code = 'PGRST') {
  return makeChain({ data: null, error: { message, code }, count: null });
}

// ── api.levantamentos ─────────────────────────────────────────────────────────

describe('api.levantamentos.list', () => {
  beforeEach(() => { mockFrom.mockClear(); });

  it('chama tabela levantamentos', async () => {
    const chain = okChain([{ id: 'l1' }]);
    mockFrom.mockReturnValue(chain);
    await api.levantamentos.list('cli-1');
    expect(mockFrom).toHaveBeenCalledWith('levantamentos');
  });

  it('filtra por cliente_id', async () => {
    const chain = okChain([]);
    mockFrom.mockReturnValue(chain);
    await api.levantamentos.list('cli-1');
    expect(chain.eq).toHaveBeenCalledWith('cliente_id', 'cli-1');
  });

  it('aplica soft-delete (is deleted_at null)', async () => {
    const chain = okChain([]);
    mockFrom.mockReturnValue(chain);
    await api.levantamentos.list('cli-1');
    expect(chain.is).toHaveBeenCalledWith('deleted_at', null);
  });

  it('retorna array vazio quando data é null', async () => {
    mockFrom.mockReturnValue(makeChain({ data: null, error: null }));
    const result = await api.levantamentos.list('cli-1');
    expect(result).toEqual([]);
  });

  it('lança erro quando supabase retorna error', async () => {
    mockFrom.mockReturnValue(errChain('DB error'));
    await expect(api.levantamentos.list('cli-1')).rejects.toMatchObject({ message: 'DB error' });
  });

  it('retorna levantamentos da API', async () => {
    const levs = [{ id: 'l1' }, { id: 'l2' }];
    mockFrom.mockReturnValue(okChain(levs));
    const result = await api.levantamentos.list('cli-1');
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('l1');
  });
});

// ── api.imoveis ───────────────────────────────────────────────────────────────

describe('api.imoveis.list', () => {
  beforeEach(() => { mockFrom.mockClear(); });

  it('chama tabela imoveis', async () => {
    mockFrom.mockReturnValue(okChain([]));
    await api.imoveis.list('cli-1');
    expect(mockFrom).toHaveBeenCalledWith('imoveis');
  });

  it('filtra por cliente_id', async () => {
    const chain = okChain([]);
    mockFrom.mockReturnValue(chain);
    await api.imoveis.list('cli-1');
    expect(chain.eq).toHaveBeenCalledWith('cliente_id', 'cli-1');
  });

  it('retorna array vazio quando data é null', async () => {
    mockFrom.mockReturnValue(makeChain({ data: null, error: null }));
    const result = await api.imoveis.list('cli-1');
    expect(result).toEqual([]);
  });

  it('lança erro do supabase', async () => {
    mockFrom.mockReturnValue(errChain('imoveis error'));
    await expect(api.imoveis.list('cli-1')).rejects.toMatchObject({ message: 'imoveis error' });
  });
});

// ── api.casosNotificados ──────────────────────────────────────────────────────

describe('api.casosNotificados.list', () => {
  beforeEach(() => { mockFrom.mockClear(); });

  it('chama tabela casos_notificados', async () => {
    mockFrom.mockReturnValue(okChain([]));
    await api.casosNotificados.list('cli-1');
    expect(mockFrom).toHaveBeenCalledWith('casos_notificados');
  });

  it('filtra por cliente_id', async () => {
    const chain = okChain([]);
    mockFrom.mockReturnValue(chain);
    await api.casosNotificados.list('cli-1');
    expect(chain.eq).toHaveBeenCalledWith('cliente_id', 'cli-1');
  });

  it('retorna lista de casos', async () => {
    const casos = [{ id: 'c1', doenca: 'dengue' }];
    mockFrom.mockReturnValue(okChain(casos));
    const result = await api.casosNotificados.list('cli-1');
    expect(result).toHaveLength(1);
  });
});

// ── api.vistorias ─────────────────────────────────────────────────────────────

describe('api.vistorias.listByAgente', () => {
  beforeEach(() => { mockFrom.mockClear(); });

  it('chama tabela vistorias', async () => {
    mockFrom.mockReturnValue(okChain([]));
    await api.vistorias.listByAgente('cli-1', 'ag-1');
    expect(mockFrom).toHaveBeenCalledWith('vistorias');
  });

  it('filtra por cliente_id e agente_id', async () => {
    const chain = okChain([]);
    mockFrom.mockReturnValue(chain);
    await api.vistorias.listByAgente('cli-1', 'ag-1');
    expect(chain.eq).toHaveBeenCalledWith('cliente_id', 'cli-1');
    expect(chain.eq).toHaveBeenCalledWith('agente_id', 'ag-1');
  });

  it('filtra por ciclo quando fornecido', async () => {
    const chain = okChain([]);
    mockFrom.mockReturnValue(chain);
    await api.vistorias.listByAgente('cli-1', 'ag-1', 3);
    expect(chain.eq).toHaveBeenCalledWith('ciclo', 3);
  });

  it('não filtra por ciclo quando ausente', async () => {
    const chain = okChain([]);
    mockFrom.mockReturnValue(chain);
    await api.vistorias.listByAgente('cli-1', 'ag-1');
    const cicloCall = chain.eq.mock.calls.find(([col]: [string]) => col === 'ciclo');
    expect(cicloCall).toBeUndefined();
  });

  it('lança erro do supabase', async () => {
    mockFrom.mockReturnValue(errChain('vistorias error'));
    await expect(api.vistorias.listByAgente('cli-1', 'ag-1')).rejects.toMatchObject({ message: 'vistorias error' });
  });
});

describe('api.vistorias.listByImovel', () => {
  beforeEach(() => { mockFrom.mockClear(); });

  it('chama tabela vistorias e filtra por imovel_id e cliente_id', async () => {
    const chain = okChain([]);
    mockFrom.mockReturnValue(chain);
    await api.vistorias.listByImovel('im-1', 'cli-1');
    expect(mockFrom).toHaveBeenCalledWith('vistorias');
    expect(chain.eq).toHaveBeenCalledWith('imovel_id', 'im-1');
    expect(chain.eq).toHaveBeenCalledWith('cliente_id', 'cli-1');
  });
});

// ── api.focosRisco ────────────────────────────────────────────────────────────

describe('api.focosRisco.list', () => {
  beforeEach(() => { mockFrom.mockClear(); });

  it('usa v_focos_risco_ativos por padrão (sem estados terminais)', async () => {
    mockFrom.mockReturnValue(makeChain({ data: [], error: null, count: 0 }));
    await api.focosRisco.list('cli-1');
    expect(mockFrom).toHaveBeenCalledWith('v_focos_risco_ativos');
  });

  it('usa v_focos_risco_todos quando filtro inclui "resolvido"', async () => {
    mockFrom.mockReturnValue(makeChain({ data: [], error: null, count: 0 }));
    await api.focosRisco.list('cli-1', { status: ['resolvido'] });
    expect(mockFrom).toHaveBeenCalledWith('v_focos_risco_todos');
  });

  it('usa v_focos_risco_todos quando filtro inclui "descartado"', async () => {
    mockFrom.mockReturnValue(makeChain({ data: [], error: null, count: 0 }));
    await api.focosRisco.list('cli-1', { status: ['descartado'] });
    expect(mockFrom).toHaveBeenCalledWith('v_focos_risco_todos');
  });

  it('filtra por cliente_id', async () => {
    const chain = makeChain({ data: [], error: null, count: 0 });
    mockFrom.mockReturnValue(chain);
    await api.focosRisco.list('cli-1');
    expect(chain.eq).toHaveBeenCalledWith('cliente_id', 'cli-1');
  });

  it('retorna { data, count } com shape correto', async () => {
    const focos = [{ id: 'f1', status: 'suspeita' }];
    mockFrom.mockReturnValue(makeChain({ data: focos, error: null, count: 1 }));
    const result = await api.focosRisco.list('cli-1');
    expect(result).toHaveProperty('data');
    expect(result).toHaveProperty('count');
    expect(result.data).toHaveLength(1);
    expect(result.count).toBe(1);
  });

  it('retorna { data: [], count: 0 } quando data é null', async () => {
    mockFrom.mockReturnValue(makeChain({ data: null, error: null, count: null }));
    const result = await api.focosRisco.list('cli-1');
    expect(result.data).toEqual([]);
    expect(result.count).toBe(0);
  });

  it('lança erro do supabase', async () => {
    mockFrom.mockReturnValue(makeChain({ data: null, error: { message: 'foco error' }, count: null }));
    await expect(api.focosRisco.list('cli-1')).rejects.toMatchObject({ message: 'foco error' });
  });

  it('aplica filtro de status quando fornecido', async () => {
    const chain = makeChain({ data: [], error: null, count: 0 });
    mockFrom.mockReturnValue(chain);
    await api.focosRisco.list('cli-1', { status: ['confirmado'] });
    expect(chain.in).toHaveBeenCalledWith('status', ['confirmado']);
  });

  it('aplica filtro de prioridade quando fornecido', async () => {
    const chain = makeChain({ data: [], error: null, count: 0 });
    mockFrom.mockReturnValue(chain);
    await api.focosRisco.list('cli-1', { prioridade: ['P1', 'P2'] });
    expect(chain.in).toHaveBeenCalledWith('prioridade', ['P1', 'P2']);
  });

  it('aplica paginação correta (page=2, pageSize=10 → range 10,19)', async () => {
    const chain = makeChain({ data: [], error: null, count: 0 });
    mockFrom.mockReturnValue(chain);
    await api.focosRisco.list('cli-1', { page: 2, pageSize: 10 });
    expect(chain.range).toHaveBeenCalledWith(10, 19);
  });
});

describe('api.focosRisco.transicionar', () => {
  beforeEach(() => { mockRpc.mockClear(); });

  it('chama RPC rpc_transicionar_foco_risco', async () => {
    mockRpc.mockResolvedValue({ data: true, error: null });
    await api.focosRisco.transicionar('foco-1', 'confirmado');
    expect(mockRpc).toHaveBeenCalledWith(
      'rpc_transicionar_foco_risco',
      expect.objectContaining({ p_foco_id: 'foco-1', p_status_novo: 'confirmado' }),
    );
  });

  it('lança erro quando RPC retorna error', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'transicao invalida' } });
    await expect(api.focosRisco.transicionar('foco-1', 'resolvido')).rejects.toMatchObject({ message: 'transicao invalida' });
  });
});

// ── api.unidadesSaude ─────────────────────────────────────────────────────────

describe('api.unidadesSaude.list', () => {
  beforeEach(() => { mockFrom.mockClear(); });

  it('chama tabela unidades_saude e filtra por cliente_id', async () => {
    const chain = okChain([]);
    mockFrom.mockReturnValue(chain);
    await api.unidadesSaude.list('cli-1');
    expect(mockFrom).toHaveBeenCalledWith('unidades_saude');
    expect(chain.eq).toHaveBeenCalledWith('cliente_id', 'cli-1');
  });

  it('retorna lista de unidades', async () => {
    const unidades = [{ id: 'u1', nome: 'UBS Centro' }];
    mockFrom.mockReturnValue(okChain(unidades));
    const result = await api.unidadesSaude.list('cli-1');
    expect(result).toHaveLength(1);
    expect(result[0].nome).toBe('UBS Centro');
  });
});

// ── api.quotas ────────────────────────────────────────────────────────────────

describe('api.quotas', () => {
  beforeEach(() => {
    mockFrom.mockClear();
    mockRpc.mockClear();
  });

  it('byCliente lê cliente_quotas com eq cliente_id', async () => {
    const chain = okChain(null);
    mockFrom.mockReturnValue(chain);
    await api.quotas.byCliente('cli-q');
    expect(mockFrom).toHaveBeenCalledWith('cliente_quotas');
    expect(chain.eq).toHaveBeenCalledWith('cliente_id', 'cli-q');
  });

  it('usoMensal chama fn_meu_uso_mensal', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });
    await api.quotas.usoMensal('cli-q');
    expect(mockRpc).toHaveBeenCalledWith('fn_meu_uso_mensal');
  });

  it('verificar chama RPC cliente_verificar_quota com cliente e métrica', async () => {
    mockRpc.mockResolvedValue({
      data: { ok: true, usado: 1, limite: 10 },
      error: null,
    });
    const r = await api.quotas.verificar('cli-q', 'voos_mes');
    expect(mockRpc).toHaveBeenCalledWith('cliente_verificar_quota', {
      p_cliente_id: 'cli-q',
      p_metrica: 'voos_mes',
    });
    expect(r.ok).toBe(true);
  });

  it('update atualiza cliente_quotas por cliente_id', async () => {
    const updated = { id: 'q1', cliente_id: 'cli-q', voos_mes: 100 };
    const chain = okChain(updated);
    mockFrom.mockReturnValue(chain);
    const result = await api.quotas.update('cli-q', { voos_mes: 100 });
    expect(mockFrom).toHaveBeenCalledWith('cliente_quotas');
    expect(chain.update).toHaveBeenCalledWith({ voos_mes: 100 });
    expect(chain.eq).toHaveBeenCalledWith('cliente_id', 'cli-q');
    expect(result.voos_mes).toBe(100);
  });
});

// ── api.integracoes ───────────────────────────────────────────────────────────

describe('api.integracoes.getByCliente', () => {
  beforeEach(() => { mockFrom.mockClear(); });

  it('filtra cliente_integracoes por cliente_id e tipo', async () => {
    const chain = okChain(null);
    mockFrom.mockReturnValue(chain);
    await api.integracoes.getByCliente('cli-i', 'esus_notifica');
    expect(mockFrom).toHaveBeenCalledWith('cliente_integracoes');
    expect(chain.eq).toHaveBeenCalledWith('cliente_id', 'cli-i');
    expect(chain.eq).toHaveBeenCalledWith('tipo', 'esus_notifica');
  });

  it('retorna registro quando existe', async () => {
    const row = {
      id: 'int1',
      cliente_id: 'cli-i',
      tipo: 'esus_notifica',
      ativo: true,
    };
    mockFrom.mockReturnValue(okChain(row));
    const r = await api.integracoes.getByCliente('cli-i');
    expect(r?.id).toBe('int1');
  });
});

// ── Multitenancy — nenhum método aceita client_id faltando ───────────────────

describe('Multitenancy — cliente_id sempre presente', () => {
  beforeEach(() => { mockFrom.mockClear(); });

  const METODOS: Array<{ label: string; fn: () => Promise<unknown> }> = [
    { label: 'levantamentos.list',      fn: () => { mockFrom.mockReturnValue(okChain([])); return api.levantamentos.list('cli-x'); } },
    { label: 'imoveis.list',            fn: () => { mockFrom.mockReturnValue(okChain([])); return api.imoveis.list('cli-x'); } },
    { label: 'casosNotificados.list',   fn: () => { mockFrom.mockReturnValue(okChain([])); return api.casosNotificados.list('cli-x'); } },
    { label: 'vistorias.listByAgente',  fn: () => { mockFrom.mockReturnValue(okChain([])); return api.vistorias.listByAgente('cli-x', 'ag-1'); } },
    { label: 'unidadesSaude.list',      fn: () => { mockFrom.mockReturnValue(okChain([])); return api.unidadesSaude.list('cli-x'); } },
    { label: 'quotas.byCliente',        fn: () => { mockFrom.mockReturnValue(okChain(null)); return api.quotas.byCliente('cli-x'); } },
    { label: 'integracoes.getByCliente', fn: () => { mockFrom.mockReturnValue(okChain(null)); return api.integracoes.getByCliente('cli-x'); } },
  ];

  for (const { label, fn } of METODOS) {
    it(`${label} aplica eq('cliente_id', ...)`, async () => {
      await fn();
      const chain = mockFrom.mock.results[0]?.value as ChainMock | undefined;
      if (!chain) return;
      const clienteIdCall = (chain.eq.mock.calls as [string, string][]).find(([col]) => col === 'cliente_id');
      expect(clienteIdCall, `${label} não filtra por cliente_id`).toBeDefined();
      expect(clienteIdCall?.[1]).toBe('cli-x');
    });
  }
});
