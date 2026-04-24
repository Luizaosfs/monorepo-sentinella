import { Injectable } from '@nestjs/common';

import { DistribuicaoQuarteirao, Quarteirao } from '../entities/quarteirao';

@Injectable()
export abstract class QuarteiraoWriteRepository {
  abstract createQuarteirao(entity: Quarteirao): Promise<Quarteirao>;
  abstract softDeleteQuarteirao(
    id: string,
    deletedBy?: string,
  ): Promise<void>;

  abstract createDistribuicao(
    entity: DistribuicaoQuarteirao,
  ): Promise<DistribuicaoQuarteirao>;
  abstract deleteDistribuicao(id: string): Promise<void>;
  abstract copiarDistribuicoesCiclo(input: {
    clienteId: string;
    cicloOrigem: number;
    cicloDestino: number;
  }): Promise<{ copiadas: number }>;

  abstract upsertMestreIfMissing(
    clienteId: string,
    bairro: string | null | undefined,
    codigo: string,
  ): Promise<void>;
}
