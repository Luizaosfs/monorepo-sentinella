import { http } from '@sentinella/api-client';

import { deepToSnake } from '../shared/case-mappers';

export type CriticidadeReincidencia = 'baixa' | 'media' | 'alta';

export interface PeriodoFilter {
  dataInicio?: string;
  dataFim?: string;
}

export interface ResumoReincidenciaDto {
  periodo: { data_inicio: string; data_fim: string };
  municipio: {
    total_ocorrencias: number;
    imoveis_reincidentes: number;
    quarteiroes_reincidentes: number;
    bairros_reincidentes: number;
    percentual_reincidencia: number;
  };
  criticidade: { baixa: number; media: number; alta: number };
}

export interface ImovelReincidenteDto {
  imovel_id: string;
  endereco: string;
  bairro: string | null;
  quarteirao: string | null;
  total_ocorrencias: number;
  ultimo_foco_em: string;
  criticidade: CriticidadeReincidencia;
}

export interface QuarteiraoReincidenteDto {
  quarteirao: string;
  bairro: string | null;
  total_ocorrencias: number;
  imoveis_reincidentes: number;
  ultimo_foco_em: string;
  criticidade: CriticidadeReincidencia;
}

export interface BairroReincidenteDto {
  bairro: string;
  total_ocorrencias: number;
  imoveis_reincidentes: number;
  quarteiroes_reincidentes: number;
  ultimo_foco_em: string;
  criticidade: CriticidadeReincidencia;
}

function toParams(f?: PeriodoFilter) {
  if (!f) return {};
  const p: Record<string, string> = {};
  if (f.dataInicio) p['dataInicio'] = f.dataInicio;
  if (f.dataFim) p['dataFim'] = f.dataFim;
  return p;
}

export const reincidenciaTerritorialApi = {
  async getResumo(filtro?: PeriodoFilter): Promise<ResumoReincidenciaDto> {
    const raw = await http.get('/reincidencia-territorial/resumo', { params: toParams(filtro) });
    return deepToSnake(raw);
  },

  async getImoveis(filtro?: PeriodoFilter): Promise<ImovelReincidenteDto[]> {
    const raw = await http.get('/reincidencia-territorial/imoveis', { params: toParams(filtro) });
    return deepToSnake(raw);
  },

  async getQuarteiroes(filtro?: PeriodoFilter): Promise<QuarteiraoReincidenteDto[]> {
    const raw = await http.get('/reincidencia-territorial/quarteiroes', { params: toParams(filtro) });
    return deepToSnake(raw);
  },

  async getBairros(filtro?: PeriodoFilter): Promise<BairroReincidenteDto[]> {
    const raw = await http.get('/reincidencia-territorial/bairros', { params: toParams(filtro) });
    return deepToSnake(raw);
  },
};
