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
    cicloOrigemId: string;
    cicloDestinoId: string;
  }): Promise<{ copiadas: number }>;

  abstract upsertMestreIfMissing(
    clienteId: string,
    bairro: string | null | undefined,
    codigo: string,
    bairroId?: string | null,
  ): Promise<string>;

  abstract saveQuarteirao(entity: Quarteirao): Promise<Quarteirao>;

  abstract atribuirQuadraTerritorial(input: {
    clienteId: string;
    quadraId: string;
    agenteId: string;
    bairroId?: string;
  }): Promise<DistribuicaoQuarteirao>;

  abstract desatribuirQuadraTerritorial(input: {
    clienteId: string;
    quadraId: string;
  }): Promise<{ removida: boolean }>;

  abstract findDistribuicaoTerritorialAtualByQuadra(
    clienteId: string,
    quadraId: string,
  ): Promise<DistribuicaoQuarteirao | null>;

  abstract deletarQuadrasBairro(
    clienteId: string,
    bairroId: string,
  ): Promise<{ deletadas: number }>;
}
