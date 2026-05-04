import { Injectable } from '@nestjs/common';

import {
  RelatorioGerado,
  ResumoDiario,
  SystemAlert,
  SystemHealthLog,
} from '../entities/dashboard';

// ── Analytics result types ────────────────────────────────────────────────────

export interface LiraaResult {
  clienteId: string;
  ciclo: number | null;
  totalInspecionados: number;
  comAcesso: number;
  totalPositivos: number;
  totalDepositos: number;
  depositosPositivos: number;
  /** Índice de Infestação Predial = (positivos / inspecionados) × 100 */
  iip: number;
  /** Índice de Breteau = (depósitos positivos / inspecionados) × 100 */
  ibp: number;
}

export interface AgenteStat {
  agente_id: string;
  agente_nome: string;
  visitas: number;
  com_acesso: number;
  sem_acesso: number;
  taxa_acesso_pct: number;
  focos: number;
  usou_larvicida: number;
  media_dia: number | null;
}

export interface ConsumoLarvicidaRow {
  agenteId: string;
  nome: string;
  depositosTratados: number;
  totalLarvicidaG: null; // campo não disponível no schema atual
  porTipo: { tipoDeposito: string; qtd: number }[];
}

export interface ResumoRegionalRow {
  regiaoId: string;
  regiaoNome: string;
  totalVistorias: number;
  vistoriasComAcesso: number;
  totalDepositos: number;
  depositosPositivos: number;
  focosAtivos: number;
}

export interface ScoreSurtoRow {
  regiao_id: string;
  regiao_nome: string;
  score_total: number;
  contrib_pluvio: number;
  contrib_recorrencia: number;
  contrib_casos_14d: number;
  contrib_sla_vencido: number;
}

export interface ResumoAgenteResult {
  agenteId: string;
  nome: string;
  ciclo: number | null;
  totalVisitas: number;
  comAcesso: number;
  semAcesso: number;
  taxaAcesso: number;
  totalDepositos: number;
  depositosPositivos: number;
  depositosTratados: number;
}

// ── Abstract repository ───────────────────────────────────────────────────────

@Injectable()
export abstract class DashboardReadRepository {
  abstract findResumos(
    clienteId: string,
    limit?: number,
  ): Promise<ResumoDiario[]>;
  abstract findRelatorios(clienteId: string): Promise<RelatorioGerado[]>;
  abstract findHealthLogs(limit?: number): Promise<SystemHealthLog[]>;
  abstract findAlerts(resolvido?: boolean): Promise<SystemAlert[]>;

  abstract calcularLiraa(
    clienteId: string,
    ciclo?: number,
  ): Promise<LiraaResult>;

  abstract comparativoAgentes(
    clienteId: string,
    ciclo?: number,
  ): Promise<AgenteStat[]>;

  abstract consumoLarvicida(
    clienteId: string,
    ciclo?: number,
  ): Promise<ConsumoLarvicidaRow[]>;

  abstract resumoRegional(
    clienteId: string,
    ciclo?: number,
    de?: Date,
    ate?: Date,
  ): Promise<ResumoRegionalRow[]>;

  abstract scoreSurtoRegioes(clienteId: string): Promise<ScoreSurtoRow[]>;

  abstract resumoAgente(
    clienteId: string,
    agenteId: string,
    ciclo?: number,
  ): Promise<ResumoAgenteResult>;

  abstract getCentralKpis(clienteId: string): Promise<CentralKpis>;
  abstract listImoveisParaHoje(
    clienteId: string,
    limit: number,
  ): Promise<ImovelParaHoje[]>;

  abstract listCiclosDisponiveis(clienteId: string): Promise<CicloDisponivel[]>;

  abstract getRegioesSemCobertura(clienteId: string): Promise<RegiaoSemCobertura[]>;

  abstract listLiraaByQuarteirao(
    clienteId: string,
    ciclo?: number,
  ): Promise<LiraaQuarteiraoRow[]>;
}

export interface RegiaoSemCobertura {
  id: string;
  regiao: string;
}

export interface LiraaQuarteiraoRow {
  cliente_id: string;
  ciclo: number;
  bairro: string | null;
  quarteirao: string | null;
  imoveis_inspecionados: number;
  imoveis_positivos: number;
  iip: number;
  ibp: number;
  total_focos: number;
  focos_a1: number;
  focos_a2: number;
  focos_b: number;
  focos_c: number;
  focos_d1: number;
  focos_d2: number;
  focos_e: number;
  larvicida_total_g: number;
}

export interface CicloDisponivel {
  id: string;
  numero: number;
  ano: number;
  status: string;
  dataInicio: Date | null;
  dataFimPrevista: Date | null;
}

export interface CentralKpis {
  clienteId: string;
  dataRef: string;
  focosPendentes: number;
  focosEmAtendimento: number;
  focosP1SemAgente: number;
  slasVencidos: number;
  slasVencendo2h: number;
  imoveisCriticos: number;
  imoveisMuitoAlto: number;
  scoreMedioMunicipio: number | null;
  vistoriasHoje: number;
  agentesAtivosHoje: number;
  denunciasUltimas24h: number;
  casosHoje: number;
}

export interface ImovelParaHoje {
  clienteId: string;
  imovelId: string;
  score: number;
  classificacao: string;
  fatores: Record<string, unknown>;
  calculadoEm: string;
  logradouro: string | null;
  numero: string | null;
  bairro: string | null;
  quarteirao: string | null;
  latitude: number | null;
  longitude: number | null;
  historicoRecusa: boolean;
  prioridadeDrone: boolean;
  slaMaisUrgente: string | null;
  prioridadeFocoAtivo: string | null;
  focosAtivosCount: number;
}
