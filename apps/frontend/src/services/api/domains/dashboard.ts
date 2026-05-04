import { http } from '@sentinella/api-client';
import { api as _sb } from '../../api-stub';
import { qs } from '../shared/qs';
import { deepToCamel, deepToSnake, type Ret } from '../shared/case-mappers';
import type { DashboardTerritorialParams, DashboardTerritorialResponse } from '@/types/dashboardTerritorial';

export const resumosDiarios = {
  list: async (clienteId: string): Promise<Ret<typeof _sb.resumosDiarios.list>> => {
    const raw = await http.get(`/dashboard/resumos${qs({ clienteId, limit: 30 })}`);
    return deepToSnake(raw) as Ret<typeof _sb.resumosDiarios.list>;
  },
  gerar: async (clienteId?: string): Promise<unknown> =>
    http.post(`/dashboard/resumos/gerar${qs({ clienteId })}`, {}),
};

export const scoreSurto = {
  porRegiao: (clienteId: string): Promise<Ret<typeof _sb.scoreSurto.porRegiao>> =>
    http.get(`/dashboard/score-surto${qs({ clienteId })}`),
};

export const dashboardAnalitico = {
  getResumo: (clienteId?: string): Promise<unknown> => http.get(`/dashboard/analitico/resumo${qs({ clienteId })}`),
  getRiscoTerritorial: (clienteId?: string): Promise<unknown> => http.get(`/dashboard/analitico/risco-territorial${qs({ clienteId })}`),
  getVulnerabilidade: (clienteId?: string): Promise<unknown> => http.get(`/dashboard/analitico/vulnerabilidade${qs({ clienteId })}`),
  getAlertaSaude: (clienteId?: string): Promise<unknown> => http.get(`/dashboard/analitico/alerta-saude${qs({ clienteId })}`),
  getResultadoOperacional: (clienteId?: string): Promise<unknown> => http.get(`/dashboard/analitico/resultado-operacional${qs({ clienteId })}`),
  getImoveisCriticos: (clienteId?: string): Promise<unknown> => http.get(`/dashboard/analitico/imoveis-criticos${qs({ clienteId })}`),
  getBairros: async (clienteId?: string): Promise<string[]> =>
    http.get(`/dashboard/analitico/bairros${qs({ clienteId })}`),
  relatorio: async (clienteId: string, periodoInicio: string, periodoFim: string): Promise<unknown> =>
    http.post(`/dashboard/relatorio-analitico${qs({ clienteId })}`, deepToCamel({ periodoInicio, periodoFim, clienteId })),
  salvarRelatorio: async (payload: { clienteId: string; periodoInicio: string; periodoFim: string; payload: unknown }): Promise<unknown> =>
    http.post(`/dashboard/relatorios${qs({ clienteId: payload.clienteId })}`, deepToCamel(payload as Record<string, unknown>)),
  listarRelatorios: async (clienteId?: string): Promise<unknown[]> => {
    const raw = await http.get(`/dashboard/relatorios${qs({ clienteId })}`);
    return deepToSnake(raw) as unknown[];
  },
};

export const central = {
  getKpis: async (): Promise<Ret<typeof _sb.central.getKpis>> => {
    const raw = await http.get('/dashboard/central-kpis');
    return deepToSnake(raw) as Ret<typeof _sb.central.getKpis>;
  },
  listImoveisParaHoje: async (
    _clienteId: string,
    limit = 30,
  ): Promise<Ret<typeof _sb.central.listImoveisParaHoje>> => {
    const raw = await http.get(`/dashboard/imoveis-para-hoje${qs({ limit })}`);
    return deepToSnake(raw) as Ret<typeof _sb.central.listImoveisParaHoje>;
  },
  getRegioesSemCobertura: async (): Promise<{ id: string; regiao: string }[]> => {
    const raw = await http.get('/dashboard/regioes-sem-cobertura');
    return (Array.isArray(raw) ? raw : []) as { id: string; regiao: string }[];
  },
};

export const executivo = {
  getKpis: (): Promise<unknown> => http.get('/dashboard/executivo/kpis'),
  getTendencia: (): Promise<unknown> => http.get('/dashboard/executivo/tendencia'),
  getCobertura: (): Promise<unknown> => http.get('/dashboard/executivo/cobertura'),
  getBairrosVariacao: (): Promise<unknown> => http.get('/dashboard/executivo/bairros-variacao'),
  getComparativoCiclos: (): Promise<unknown> => http.get('/dashboard/executivo/comparativo-ciclos'),
};

export const eficacia = {
  listPorDeposito: (): Promise<unknown> => http.get('/dashboard/eficacia/tratamento'),
  listFocosResolvidos: (): Promise<unknown> => http.get('/dashboard/eficacia/tratamento'),
};

export const reincidencia = {
  listImoveisReincidentes: (): Promise<unknown> => http.get('/dashboard/reincidencia/imoveis'),
  listPorDeposito: (): Promise<unknown> => http.get('/dashboard/reincidencia/por-deposito'),
  listSazonalidade: (): Promise<unknown> => http.get('/dashboard/reincidencia/sazonalidade'),
  scoreImovel: (imovelId: string): Promise<unknown> => http.get(`/risk-engine/score/imovel/${imovelId}`),
  historicoCiclosImovel: (imovelId: string): Promise<unknown> =>
    http.get(`/dashboard/reincidencia/historico-ciclos${qs({ imovelId })}`),
};

type RegionalKpiRow = {
  cliente_id: string;
  municipio_nome: string;
  total_focos: number | string | null;
  focos_ativos: number | string | null;
  focos_resolvidos: number | string | null;
};

export const admin = {
  comparativoMunicipios: async (): Promise<import('@/types/database').MunicipioStats[]> => {
    const raw = await http.get<RegionalKpiRow[]>('/analytics/regional/comparativo-municipios');
    const rows = Array.isArray(raw) ? raw : [];
    return rows.map((r) => {
      const total = Number(r.total_focos) || 0;
      const resolvidos = Number(r.focos_resolvidos) || 0;
      const ativos = Number(r.focos_ativos) || 0;
      return {
        clienteId: r.cliente_id,
        nome: r.municipio_nome,
        total,
        resolvidos,
        pendentes: ativos,
        em_atendimento: 0,
        criticos: 0,
        altos: 0,
      };
    });
  },
};

export const piloto = {
  getFunilHoje: (): Promise<unknown> => http.get('/dashboard/piloto/funil-hoje'),
  getDespachosSupervisor: (): Promise<unknown> => http.get('/dashboard/piloto/despachos-supervisor'),
  getProdAgentes: (): Promise<unknown> => http.get('/dashboard/piloto/prod-agentes'),
};

// clienteId vem do JWT — nunca enviar por query
export const territorial = {
  getTerritorial: (params: DashboardTerritorialParams = {}): Promise<DashboardTerritorialResponse> =>
    http.get(`/dashboard/territorial${qs(params)}`),
};
