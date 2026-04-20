import { Injectable } from '@nestjs/common';

import { FilterDistribuicaoInput } from '../dtos/filter-distribuicao.input';
import { FilterQuarteiraoInput } from '../dtos/filter-quarteirao.input';
import { DistribuicaoQuarteirao, Quarteirao } from '../entities/quarteirao';

export type CoberturaQuarteiraoItem = {
  quarteirao: string;
  total_imoveis: number;
  visitados: number;
  pct_cobertura: number;
};

export type CoberturaCicloResult = CoberturaQuarteiraoItem[];

@Injectable()
export abstract class QuarteiraoReadRepository {
  abstract findQuarteiraoById(id: string): Promise<Quarteirao | null>;
  abstract findAllQuarteiroes(
    filters: FilterQuarteiraoInput,
  ): Promise<Quarteirao[]>;

  abstract findAllDistribuicoes(
    filters: FilterDistribuicaoInput,
  ): Promise<DistribuicaoQuarteirao[]>;
  abstract findDistribuicaoById(
    id: string,
  ): Promise<DistribuicaoQuarteirao | null>;

  abstract coberturaQuarteiraoCiclo(input: {
    clienteId: string;
    ciclo: number;
  }): Promise<CoberturaCicloResult>;
}
