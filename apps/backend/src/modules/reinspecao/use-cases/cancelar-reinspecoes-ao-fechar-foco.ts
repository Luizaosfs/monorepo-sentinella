import { Injectable, Logger } from '@nestjs/common';

import { ReinspecaoWriteRepository } from '../repositories/reinspecao-write.repository';

/**
 * Quando o foco transita para `resolvido` ou `descartado`, cancela TODAS
 * as reinspeções ainda pendentes desse foco em lote. Motivo fixo conforme
 * trigger original: "Foco fechado automaticamente".
 *
 * Idempotente (UPDATE filtrado por status='pendente') — disparar 2x não
 * re-cancela nada. Retorna a contagem de reinspeções canceladas.
 */
const MOTIVO_CANCELAMENTO_AUTOMATICO = 'Foco fechado automaticamente';

@Injectable()
export class CancelarReinspecoesAoFecharFoco {
  private readonly logger = new Logger(CancelarReinspecoesAoFecharFoco.name);

  constructor(private writeRepo: ReinspecaoWriteRepository) {}

  async execute(
    focoRiscoId: string,
    canceladoPor?: string,
    tx?: unknown,
  ): Promise<number> {
    const count = await this.writeRepo.cancelarPendentesPorFoco(
      focoRiscoId,
      MOTIVO_CANCELAMENTO_AUTOMATICO,
      canceladoPor,
      tx,
    );
    if (count > 0) {
      this.logger.log(
        `Reinspeções canceladas ao fechar foco: foco=${focoRiscoId} total=${count}`,
      );
    }
    return count;
  }
}
