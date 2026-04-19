import { http } from '@sentinella/api-client';
import { api as _sb } from '../../api-stub';
import { qs } from '../shared/qs';
import { deepToSnake, type Ret } from '../shared/case-mappers';

export const resumosDiarios = {
  list: async (clienteId: string): Promise<Ret<typeof _sb.resumosDiarios.list>> => {
    const raw = await http.get(`/dashboard/resumos${qs({ clienteId, limit: 30 })}`);
    return deepToSnake(raw) as Ret<typeof _sb.resumosDiarios.list>;
  },
  gerar: async () => { throw new Error('[sem endpoint NestJS] resumosDiarios.gerar'); },
};

export const scoreSurto = {
  porRegiao: (clienteId: string): Promise<Ret<typeof _sb.scoreSurto.porRegiao>> =>
    http.get(`/dashboard/score-surto${qs({ clienteId })}`),
};

export const dashboardAnalitico = {
  getResumo: (): Promise<unknown> => http.get('/dashboard/analitico/resumo'),
  getRiscoTerritorial: (): Promise<unknown> => http.get('/dashboard/analitico/risco-territorial'),
  getVulnerabilidade: (): Promise<unknown> => http.get('/dashboard/analitico/vulnerabilidade'),
  getAlertaSaude: (): Promise<unknown> => http.get('/dashboard/analitico/alerta-saude'),
  getResultadoOperacional: (): Promise<unknown> => http.get('/dashboard/analitico/resultado-operacional'),
  getImoveisCriticos: (): Promise<unknown> => http.get('/dashboard/analitico/imoveis-criticos'),
  getBairros: async () => { throw new Error('[sem endpoint NestJS] dashboardAnalitico.getBairros'); },
  relatorio: async () => { throw new Error('[sem endpoint NestJS] dashboardAnalitico.relatorio'); },
  salvarRelatorio: async () => { throw new Error('[sem endpoint NestJS] dashboardAnalitico.salvarRelatorio'); },
  listarRelatorios: async () => { throw new Error('[sem endpoint NestJS] dashboardAnalitico.listarRelatorios'); },
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

export const admin = {
  comparativoMunicipios: (): Promise<unknown> => http.get('/analytics/regional/comparativo-municipios'),
};

export const piloto = {
  getFunilHoje: (): Promise<unknown> => http.get('/dashboard/piloto/funil-hoje'),
  getDespachosSupervisor: (): Promise<unknown> => http.get('/dashboard/piloto/despachos-supervisor'),
  getProdAgentes: (): Promise<unknown> => http.get('/dashboard/piloto/prod-agentes'),
};
