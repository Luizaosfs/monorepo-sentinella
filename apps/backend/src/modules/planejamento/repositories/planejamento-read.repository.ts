import { Injectable } from '@nestjs/common';

import { FilterPlanejamentoInput } from '../dtos/filter-planejamento.input';
import { Planejamento } from '../entities/planejamento';

@Injectable()
export abstract class PlanejamentoReadRepository {
  abstract findById(id: string, clienteId: string | null): Promise<Planejamento | null>;
  abstract findAll(filters: FilterPlanejamentoInput): Promise<Planejamento[]>;
  abstract findAtivos(clienteId: string): Promise<Planejamento[]>;
  abstract findAtivosManuais(clienteId: string): Promise<Planejamento[]>;
}
