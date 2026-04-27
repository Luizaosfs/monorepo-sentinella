import { Injectable } from '@nestjs/common';
import { PaginationProps } from 'src/shared/dtos/pagination-body';

import { FilterImovelInput } from '../dtos/filter-imovel.input';
import { Imovel, ImovelPaginated } from '../entities/imovel';

export interface ScoreConfig {
  pesoFocoSuspeito: number;
  pesoFocoConfirmado: number;
  pesoFocoEmTratamento: number;
  pesoFocoRecorrente: number;
  pesoHistorico3focos: number;
  pesoCaso300m: number;
  pesoChuvaAlta: number;
  pesoTemperatura30: number;
  pesoDenunciaCidadao: number;
  pesoSlaVencido: number;
  pesoVistoriaNegativa: number;
  pesoImovelRecusa: number;
  pesoFocoResolvido: number;
  janelaResolucaoDias: number;
  janelaVistoriaDias: number;
  janelaCasoDias: number;
  capFocos: number;
  capEpidemio: number;
  capHistorico: number;
}

export interface ScoreInputs {
  imovel: Imovel | null;
  config: ScoreConfig | null;
  focosAtivos: { status: string; focoAnteriorId: string | null }[];
  historicoFocosCount: number;
  focosResolvidosCount: number;
  slaVencidosCount: number;
  vistoriasNegativasCount: number;
  casosProximosCount: number;
  denunciaCidadaoCount: number;
  chuvaAlta: boolean;
  tempAlta: boolean;
}

export interface ImovelResumo {
  id: string;
  clienteId: string;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  quarteirao: string | null;
  regiaoId: string | null;
  tipoImovel: string;
  latitude: number | null;
  longitude: number | null;
  ativo: boolean;
  historicoRecusa: boolean;
  prioridadeDrone: boolean;
  temCalha: boolean;
  calhaAcessivel: boolean;
  createdAt: string;
  updatedAt: string;
  totalVistorias: number;
  ultimaVisita: string | null;
  tentativasSemAcesso: number;
  totalFocosHistorico: number;
  focosAtivos: number;
  ultimoFocoEm: string | null;
  slasAbertos: number;
  focosRecorrentes: number;
  scoreTerritorial: number | null;
  scoreClassificacao: string | null;
  scoreFatores: Record<string, unknown> | null;
  scoreCalculadoEm: string | null;
}

export interface ImovelHistoricoAcesso {
  imovelId: string;
  clienteId: string;
  logradouro: string | null;
  numero: string | null;
  bairro: string | null;
  quarteirao: string | null;
  proprietarioAusente: boolean;
  tipoAusencia: string | null;
  temAnimalAgressivo: boolean;
  historicoRecusa: boolean;
  prioridadeDrone: boolean;
  temCalha: boolean;
  calhaAcessivel: boolean;
  notificacaoFormalEm: string | null;
  totalVisitas: number;
  totalSemAcesso: number;
  pctSemAcesso: number;
  ultimaVisitaComAcesso: string | null;
  ultimaTentativa: string | null;
  requerNotificacaoFormal: boolean;
}

@Injectable()
export abstract class ImovelReadRepository {
  abstract findById(id: string, clienteId: string | null): Promise<Imovel | null>;
  abstract findAll(filters: FilterImovelInput): Promise<Imovel[]>;
  abstract findPaginated(
    filters: FilterImovelInput,
    pagination: PaginationProps,
  ): Promise<ImovelPaginated>;
  abstract findScoreInputs(imovelId: string, clienteId: string): Promise<ScoreInputs>;
  abstract findScoreConfig(clienteId: string): Promise<ScoreConfig | null>;
  abstract listResumo(clienteId: string, regiaoId?: string): Promise<ImovelResumo[]>;
  abstract getResumoById(id: string, clienteId: string | null): Promise<ImovelResumo | null>;
  abstract listProblematicos(clienteId: string): Promise<ImovelHistoricoAcesso[]>;
}
