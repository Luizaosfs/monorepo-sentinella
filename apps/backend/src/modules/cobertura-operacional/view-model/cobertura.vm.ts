export type StatusCobertura = 'sem_cobertura' | 'parcial' | 'coberto';

export interface ResumoCoberturaDto {
  ciclo: {
    id: string;
    numero: number;
    nome: string;
  } | null;
  municipio: {
    totalImoveis: number;
    totalVisitados: number;
    totalPendentes: number;
    percentualCobertura: number;
  };
  quarteiroes: {
    total: number;
    cobertos: number;
    parcialmenteCobertos: number;
    semCobertura: number;
  };
  agentes: {
    total: number;
    comCobertura: number;
    semCobertura: number;
  };
  indicadores: {
    imoveisNuncaVisitados: number;
    quarteiroesNuncaVisitados: number;
  };
}

export interface CoberturaQuarteiraoDto {
  quarteirao: string;
  totalImoveis: number;
  visitados: number;
  pendentes: number;
  percentualCobertura: number;
  status: StatusCobertura;
}

export interface CoberturaAgenteDto {
  agenteId: string;
  nome: string;
  totalImoveis: number;
  visitados: number;
  pendentes: number;
  percentualCobertura: number;
}

export interface ImovelNuncaVisitadoDto {
  id: string;
  logradouro: string | null;
  numero: string | null;
  bairro: string | null;
  quarteirao: string | null;
  agenteId: string | null;
  agenteNome: string | null;
  diasSemVistoria: number;
}

export function calcularStatus(visitados: number, total: number): StatusCobertura {
  if (total === 0 || visitados === 0) return 'sem_cobertura';
  const pct = (visitados / total) * 100;
  if (pct >= 80) return 'coberto';
  return 'parcial';
}

export function calcularPercentual(visitados: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((visitados / total) * 100);
}
