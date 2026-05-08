export type CriticidadeReincidencia = 'baixa' | 'media' | 'alta';

export interface ResumoReincidenciaDto {
  periodo: { dataInicio: string; dataFim: string };
  municipio: {
    totalOcorrencias: number;
    imoveisReincidentes: number;
    quarteiroesReincidentes: number;
    bairrosReincidentes: number;
    percentualReincidencia: number;
  };
  criticidade: { baixa: number; media: number; alta: number };
}

export interface ImovelReincidenteDto {
  imovelId: string;
  endereco: string;
  bairro: string | null;
  quarteirao: string | null;
  totalOcorrencias: number;
  ultimoFocoEm: string;
  criticidade: CriticidadeReincidencia;
}

export interface QuarteiraoReincidenteDto {
  quarteirao: string;
  bairro: string | null;
  totalOcorrencias: number;
  imoveisReincidentes: number;
  ultimoFocoEm: string;
  criticidade: CriticidadeReincidencia;
}

export interface BairroReincidenteDto {
  bairro: string;
  totalOcorrencias: number;
  imoveisReincidentes: number;
  quarteiroesReincidentes: number;
  ultimoFocoEm: string;
  criticidade: CriticidadeReincidencia;
}

/** Imóvel: baixa=2, media=3, alta=4+ */
export function calcularCriticidadeImovel(total: number): CriticidadeReincidencia {
  if (total >= 4) return 'alta';
  if (total === 3) return 'media';
  return 'baixa';
}

/** Quarteirão/Bairro: baseado em count de imóveis reincidentes */
export function calcularCriticidadeAgregado(imoveisReincidentes: number): CriticidadeReincidencia {
  if (imoveisReincidentes >= 4) return 'alta';
  if (imoveisReincidentes >= 2) return 'media';
  return 'baixa';
}

export function parsePeriodo(dataInicio?: string, dataFim?: string): { inicio: Date; fim: Date } {
  const fim = dataFim ? new Date(dataFim) : new Date();
  const inicio = dataInicio
    ? new Date(dataInicio)
    : new Date(fim.getTime() - 90 * 24 * 60 * 60 * 1000);
  return { inicio, fim };
}
