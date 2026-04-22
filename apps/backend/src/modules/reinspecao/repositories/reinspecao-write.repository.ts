import { Injectable } from '@nestjs/common';

import { Reinspecao } from '../entities/reinspecao';

@Injectable()
export abstract class ReinspecaoWriteRepository {
  abstract create(entity: Reinspecao): Promise<Reinspecao>;
  abstract createWithTx(entity: Reinspecao, tx?: unknown): Promise<Reinspecao>;
  abstract save(entity: Reinspecao): Promise<void>;
  abstract cancelarPendentesPorFoco(
    focoRiscoId: string,
    motivo: string,
    canceladoPor?: string,
    tx?: unknown,
  ): Promise<number>;
  abstract marcarPendentesVencidas(): Promise<{ atualizadas: number }>;
}
