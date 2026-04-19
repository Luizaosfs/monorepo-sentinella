import { Injectable } from '@nestjs/common';
import { PaginationProps } from 'src/shared/dtos/pagination-body';

import { FilterLevantamentoInput } from '../dtos/filter-levantamento.input';
import {
  Levantamento,
  LevantamentoItem,
  LevantamentoPaginated,
} from '../entities/levantamento';

export interface PlanejamentoInfo {
  id: string;
  ativo: boolean;
  clienteId: string | null;
  tipoEntrada: string | null;
}

export interface SlaConfigInfo {
  config: Record<string, unknown>;
}

export interface ItemEvidencia {
  id: string;
  itemId: string;
  url: string;
  tipo: string | null;
  legenda: string | null;
  publicId: string | null;
  createdAt: Date;
}

@Injectable()
export abstract class LevantamentoReadRepository {
  abstract findById(id: string): Promise<Levantamento | null>;
  abstract findByIdComItens(id: string): Promise<Levantamento | null>;
  abstract findAll(filters: FilterLevantamentoInput): Promise<Levantamento[]>;
  abstract findPaginated(
    filters: FilterLevantamentoInput,
    pagination: PaginationProps,
  ): Promise<LevantamentoPaginated>;
  abstract findItensByLevantamentoId(
    levantamentoId: string,
  ): Promise<LevantamentoItem[]>;
  abstract findItemById(id: string): Promise<LevantamentoItem | null>;
  abstract findPlanejamento(id: string): Promise<PlanejamentoInfo | null>;
  abstract findByPlanejamentoDataTipo(
    clienteId: string,
    planejamentoId: string,
    dataVoo: Date,
    tipoEntrada: string,
  ): Promise<Levantamento | null>;
  abstract findSlaConfig(clienteId: string): Promise<SlaConfigInfo | null>;
  abstract findItemEvidencias(itemId: string): Promise<ItemEvidencia[]>;
}
