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
  agenteId: string;
  nome: string;
  totalVisitas: number;
  comAcesso: number;
  semAcesso: number;
  taxaAcesso: number;
  totalDepositos: number;
  depositosComLarva: number;
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
  regiaoId: string;
  regiaoNome: string;
  chuva7d: number;
  diasPosChuva: number;
  focosAtivos: number;
  /** Score composto 0–100 */
  scoreSurto: number;
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
