import { Injectable } from '@nestjs/common';

import { FilterReinspecaoInput } from '../dtos/filter-reinspecao.input';
import { Reinspecao } from '../entities/reinspecao';

@Injectable()
export abstract class ReinspecaoReadRepository {
  abstract findById(id: string, clienteId: string | null): Promise<Reinspecao | null>;
  abstract findAll(filters: FilterReinspecaoInput): Promise<Reinspecao[]>;
  abstract countPendentes(clienteId: string, agenteId?: string): Promise<number>;
  abstract findPendenteByFocoETipo(
    focoRiscoId: string,
    tipo: string,
    tx?: unknown,
  ): Promise<Reinspecao | null>;
  /** Retorna reinspeções cujo foco pertence a quadras do território do agente. */
  abstract findAllTerritorio(clienteId: string, quadraIds: string[]): Promise<Reinspecao[]>;
  /** Conta pendentes/vencidas por território (join foco → imóvel → quadra). */
  abstract countPendentesTerritorio(clienteId: string, quadraIds: string[]): Promise<number>;
}
