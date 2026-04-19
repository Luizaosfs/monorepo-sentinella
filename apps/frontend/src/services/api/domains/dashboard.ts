import { http } from '@sentinella/api-client';
import { api as _sb } from '../../api-stub';
import { qs } from '../shared/qs';
import { deepToSnake, type Ret } from '../shared/case-mappers';

export const resumosDiarios = {
  /**
   * Lista resumos diários do cliente (últimos 30).
   * Backend: GET /dashboard/resumos (TenantGuard injeta clienteId via JWT).
   */
  list: async (
    clienteId: string,
  ): Promise<Ret<typeof _sb.resumosDiarios.list>> => {
    try {
      const raw = await http.get(`/dashboard/resumos${qs({ clienteId, limit: 30 })}`);
      return deepToSnake(raw) as Ret<typeof _sb.resumosDiarios.list>;
    } catch { return _sb.resumosDiarios.list(clienteId); }
  },

  /** @fallback Chama edge function resumo-diario — sem endpoint REST equivalente. */
  gerar: _sb.resumosDiarios.gerar.bind(_sb.resumosDiarios),
};

export const scoreSurto = {
  /**
   * Score de risco de surto por região (substitui RPC rpc_score_surto_regioes).
   * Backend: GET /dashboard/score-surto?clienteId
   */
  porRegiao: async (
    clienteId: string,
  ): Promise<Ret<typeof _sb.scoreSurto.porRegiao>> => {
    try { return await http.get(`/dashboard/score-surto${qs({ clienteId })}`); }
    catch { return _sb.scoreSurto.porRegiao(clienteId); }
  },
};

// @fallback — views v_dashboard_analitico_* sem endpoint NestJS
export const dashboardAnalitico = {
  /** @fallback View v_dashboard_analitico_resumo — sem endpoint NestJS. */
  getResumo: _sb.dashboardAnalitico.getResumo.bind(_sb.dashboardAnalitico),
  /** @fallback View v_dashboard_analitico_risco_territorial — sem endpoint NestJS. */
  getRiscoTerritorial: _sb.dashboardAnalitico.getRiscoTerritorial.bind(_sb.dashboardAnalitico),
  /** @fallback View v_dashboard_analitico_vulnerabilidade — sem endpoint NestJS. */
  getVulnerabilidade: _sb.dashboardAnalitico.getVulnerabilidade.bind(_sb.dashboardAnalitico),
  /** @fallback View v_dashboard_analitico_alerta_saude — sem endpoint NestJS. */
  getAlertaSaude: _sb.dashboardAnalitico.getAlertaSaude.bind(_sb.dashboardAnalitico),
  /** @fallback View v_dashboard_analitico_resultado_operacional — sem endpoint NestJS. */
  getResultadoOperacional: _sb.dashboardAnalitico.getResultadoOperacional.bind(_sb.dashboardAnalitico),
  /** @fallback View v_dashboard_analitico_imoveis_criticos — sem endpoint NestJS. */
  getImoveisCriticos: _sb.dashboardAnalitico.getImoveisCriticos.bind(_sb.dashboardAnalitico),
  /** @fallback View v_dashboard_analitico_risco_territorial (bairros) — sem endpoint NestJS. */
  getBairros: _sb.dashboardAnalitico.getBairros.bind(_sb.dashboardAnalitico),
  /** @fallback RPC rpc_gerar_relatorio_analitico — shape diverge de POST /dashboard/relatorio-analitico. */
  relatorio: _sb.dashboardAnalitico.relatorio.bind(_sb.dashboardAnalitico),
  /** @fallback Insert raw em relatorios_gerados ≠ POST /dashboard/relatorios (use case). */
  salvarRelatorio: _sb.dashboardAnalitico.salvarRelatorio.bind(_sb.dashboardAnalitico),
  /** @fallback Shape DashboardViewModel.relatorioToHttp não confirmado. */
  listarRelatorios: _sb.dashboardAnalitico.listarRelatorios.bind(_sb.dashboardAnalitico),
};

export const central = {
  /** HTTP GET /dashboard/central-kpis — substitui v_central_operacional. */
  getKpis: async (): Promise<Ret<typeof _sb.central.getKpis>> => {
    try {
      const raw = await http.get('/dashboard/central-kpis');
      return deepToSnake(raw) as Ret<typeof _sb.central.getKpis>;
    } catch {
      return _sb.central.getKpis();
    }
  },
  /** HTTP GET /dashboard/imoveis-para-hoje — substitui v_imoveis_para_hoje. */
  listImoveisParaHoje: async (
    clienteId: string,
    limit = 30,
  ): Promise<Ret<typeof _sb.central.listImoveisParaHoje>> => {
    try {
      const raw = await http.get(`/dashboard/imoveis-para-hoje${qs({ limit })}`);
      return deepToSnake(raw) as Ret<typeof _sb.central.listImoveisParaHoje>;
    } catch {
      return _sb.central.listImoveisParaHoje(clienteId, limit);
    }
  },
};

// @fallback — views v_executivo_* sem endpoint NestJS
export const executivo = {
  /** @fallback View v_executivo_kpis (RLS por usuário logado) — sem endpoint NestJS. */
  getKpis: _sb.executivo.getKpis.bind(_sb.executivo),
  /** @fallback View v_executivo_tendencia — sem endpoint NestJS. */
  getTendencia: _sb.executivo.getTendencia.bind(_sb.executivo),
  /** @fallback View v_executivo_cobertura — sem endpoint NestJS. */
  getCobertura: _sb.executivo.getCobertura.bind(_sb.executivo),
  /** @fallback View v_executivo_bairros_variacao — sem endpoint NestJS. */
  getBairrosVariacao: _sb.executivo.getBairrosVariacao.bind(_sb.executivo),
  /** @fallback View v_executivo_comparativo_ciclos (RLS por usuário) — sem endpoint NestJS. */
  getComparativoCiclos: _sb.executivo.getComparativoCiclos.bind(_sb.executivo),
};

// @fallback — view + query direta sem endpoint NestJS
export const eficacia = {
  /** @fallback View v_eficacia_tratamento — sem endpoint NestJS. */
  listPorDeposito: _sb.eficacia.listPorDeposito.bind(_sb.eficacia),
  /** @fallback Query direta em focos_risco com join imoveis — sem endpoint NestJS dedicado. */
  listFocosResolvidos: _sb.eficacia.listFocosResolvidos.bind(_sb.eficacia),
};

// @fallback — views + RPC + join sem endpoint NestJS
export const reincidencia = {
  /** @fallback View v_imoveis_reincidentes — sem endpoint NestJS. */
  listImoveisReincidentes: _sb.reincidencia.listImoveisReincidentes.bind(_sb.reincidencia),
  /** @fallback View v_reincidencia_por_deposito — sem endpoint NestJS. */
  listPorDeposito: _sb.reincidencia.listPorDeposito.bind(_sb.reincidencia),
  /** @fallback View v_reincidencia_sazonalidade — sem endpoint NestJS. */
  listSazonalidade: _sb.reincidencia.listSazonalidade.bind(_sb.reincidencia),
  /** @fallback RPC fn_risco_reincidencia_imovel — sem endpoint NestJS. */
  scoreImovel: _sb.reincidencia.scoreImovel.bind(_sb.reincidencia),
  /** @fallback Query vistorias com join agente+depositos — sem endpoint NestJS. */
  historicoCiclosImovel: _sb.reincidencia.historicoCiclosImovel.bind(_sb.reincidencia),
};

// @fallback — query focos_risco+clientes sem endpoint NestJS dedicado
export const admin = {
  comparativoMunicipios: _sb.admin.comparativoMunicipios.bind(_sb.admin),
};

// @fallback — views v_piloto_* sem endpoint NestJS
export const piloto = {
  getFunilHoje: _sb.piloto.getFunilHoje.bind(_sb.piloto),
  getDespachosSupervisor: _sb.piloto.getDespachosSupervisor.bind(_sb.piloto),
  getProdAgentes: _sb.piloto.getProdAgentes.bind(_sb.piloto),
};
