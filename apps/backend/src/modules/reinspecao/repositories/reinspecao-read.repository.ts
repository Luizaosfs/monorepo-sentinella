import { Injectable } from '@nestjs/common';

import { FilterReinspecaoInput } from '../dtos/filter-reinspecao.input';
import { Reinspecao } from '../entities/reinspecao';

@Injectable()
export abstract class ReinspecaoReadRepository {
  abstract findById(id: string, clienteId?: string | null): Promise<Reinspecao | null>;
  abstract findAll(filters: FilterReinspecaoInput): Promise<Reinspecao[]>;
  abstract countPendentes(clienteId: string, agenteId?: string): Promise<number>;
  abstract findPendenteByFocoETipo(
    focoRiscoId: string,
    tipo: string,
    tx?: unknown,
  ): Promise<Reinspecao | null>;
}
