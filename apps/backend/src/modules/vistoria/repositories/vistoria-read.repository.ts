import { Injectable } from '@nestjs/common';
import { PaginationProps } from '@shared/dtos/pagination-body';

import { FilterVistoriaInput } from '../dtos/filter-vistoria.input';
import { Vistoria, VistoriaPaginated } from '../entities/vistoria';

export interface SintomaConsolidacao {
  febre: boolean;
  manchasVermelhas: boolean;
  dorArticulacoes: boolean;
  dorCabeca: boolean;
  moradoresSintomasQtd: number;
}

export interface RiscoConsolidacao {
  menorIncapaz: boolean;
  idosoIncapaz: boolean;
  depQuimico: boolean;
  riscoAlimentar: boolean;
  riscoMoradia: boolean;
  criadouroAnimais: boolean;
  lixo: boolean;
  residuosOrganicos: boolean;
  residuosQuimicos: boolean;
  residuosMedicos: boolean;
  acumuloMaterialOrganico: boolean;
  animaisSinaisLv: boolean;
  caixaDestampada: boolean;
  outroRiscoVetorial: string | null;
}

export interface DepositoAgregado {
  qtdComFocosTotal: number;
  qtdInspecionados: number;
}

export interface CalhaAgregada {
  comFoco: boolean;
  comAguaParada: boolean;
}

export interface VistoriaParaConsolidacao {
  imovelId: string | null;
  acessoRealizado: boolean;
  moradoresQtd: number | null;
  gravidas: boolean;
  idosos: boolean;
  criancas7anos: boolean;
  clienteId: string;
  consolidadoEm: Date | null;
  prioridadeFinal: string | null;
  dimensaoDominante: string | null;
  consolidacaoJson: Record<string, unknown> | null;
  versaoRegraConsolidacao: string | null;
  versaoPesosConsolidacao: string | null;
}

export interface DadosConsolidacao {
  vistoria: VistoriaParaConsolidacao;
  sintomas: SintomaConsolidacao | null;
  riscos: RiscoConsolidacao | null;
  depositos: DepositoAgregado;
  calhas: CalhaAgregada;
}

@Injectable()
export abstract class VistoriaReadRepository {
  abstract findById(id: string): Promise<Vistoria | null>;
  abstract findByIdIncludingDeleted(id: string): Promise<Vistoria | null>;
  abstract findByIdComDetalhes(id: string): Promise<Vistoria | null>;
  abstract findAll(filters: FilterVistoriaInput): Promise<Vistoria[]>;
  abstract findPaginated(
    filters: FilterVistoriaInput,
    pagination: PaginationProps,
  ): Promise<VistoriaPaginated>;
  abstract count(filters: FilterVistoriaInput): Promise<number>;
  abstract findDadosParaConsolidacao(vistoriaId: string): Promise<DadosConsolidacao | null>;
  abstract countSemAcessoPorImovel(imovelId: string, desde?: Date): Promise<number>;
  abstract findCalhasByVistoriaId(
    vistoriaId: string,
  ): Promise<Array<{ id: string; fotoPublicId: string | null; fotoUrl: string | null }>>;
}
