import { Injectable } from '@nestjs/common';
import { PaginationProps } from 'src/shared/dtos/pagination-body';

import { FilterFocoRiscoInput } from '../dtos/filter-foco-risco.input';
import { FocoRisco, FocoRiscoPaginated } from '../entities/foco-risco';

export interface ContagemTriagemResult {
  total: number;
  suspeita: number;
  em_triagem: number;
  aguarda_inspecao: number;
  em_inspecao: number;
  p1p2: number;
  sem_responsavel: number;
}

@Injectable()
export abstract class FocoRiscoReadRepository {
  abstract findById(id: string): Promise<FocoRisco | null>;
  abstract findByIdComHistorico(id: string): Promise<FocoRisco | null>;
  abstract findAll(filters: FilterFocoRiscoInput): Promise<FocoRisco[]>;
  abstract findPaginated(
    filters: FilterFocoRiscoInput,
    pagination: PaginationProps,
  ): Promise<FocoRiscoPaginated>;
  abstract findManyByIds(ids: string[], clienteId: string): Promise<FocoRisco[]>;
  abstract findContagemTriagem(filters: FilterFocoRiscoInput): Promise<ContagemTriagemResult>;
}
