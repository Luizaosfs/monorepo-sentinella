import { http } from '@sentinella/api-client';

import { deepToSnake } from '../shared/case-mappers';

export type StatusCobertura = 'sem_cobertura' | 'parcial' | 'coberto';

export interface ResumoCoberturaDto {
  ciclo: { id: string; numero: number; nome: string } | null;
  municipio: {
    total_imoveis: number;
    total_visitados: number;
    total_pendentes: number;
    percentual_cobertura: number;
  };
  quarteiroes: {
    total: number;
    cobertos: number;
    parcialmente_cobertos: number;
    sem_cobertura: number;
  };
  agentes: {
    total: number;
    com_cobertura: number;
    sem_cobertura: number;
  };
  indicadores: {
    imoveis_nunca_visitados: number;
    quarteiroes_nunca_visitados: number;
  };
}

export interface CoberturaQuarteiraoDto {
  quarteirao: string;
  total_imoveis: number;
  visitados: number;
  pendentes: number;
  percentual_cobertura: number;
  status: StatusCobertura;
}

export interface CoberturaAgenteDto {
  agente_id: string;
  nome: string;
  total_imoveis: number;
  visitados: number;
  pendentes: number;
  percentual_cobertura: number;
}

export interface ImovelNuncaVisitadoDto {
  id: string;
  logradouro: string | null;
  numero: string | null;
  bairro: string | null;
  quarteirao: string | null;
  agente_id: string | null;
  agente_nome: string | null;
  dias_sem_vistoria: number;
}

export const coberturaOperacionalApi = {
  async getResumo(): Promise<ResumoCoberturaDto> {
    const raw = await http.get('/cobertura-operacional/resumo');
    return deepToSnake(raw);
  },

  async getQuarteiroes(): Promise<CoberturaQuarteiraoDto[]> {
    const raw = await http.get('/cobertura-operacional/quarteiroes');
    return deepToSnake(raw);
  },

  async getAgentes(): Promise<CoberturaAgenteDto[]> {
    const raw = await http.get('/cobertura-operacional/agentes');
    return deepToSnake(raw);
  },

  async getImoveisNuncaVisitados(): Promise<ImovelNuncaVisitadoDto[]> {
    const raw = await http.get('/cobertura-operacional/imoveis-nunca-visitados');
    return deepToSnake(raw);
  },
};
