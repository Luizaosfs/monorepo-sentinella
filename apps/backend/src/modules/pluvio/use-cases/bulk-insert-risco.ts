import { Injectable } from '@nestjs/common';

import { UpsertPluvioRiscoInput } from '../dtos/upsert-pluvio-risco.body';
import { PluvioRisco } from '../entities/pluvio';
import { PluvioWriteRepository } from '../repositories/pluvio-write.repository';

@Injectable()
export class BulkInsertRisco {
  constructor(private repository: PluvioWriteRepository) {}

  async execute(inputs: UpsertPluvioRiscoInput[]) {
    const riscos = inputs.map(
      (input) =>
        new PluvioRisco(
          {
            regiaoId: input.regiaoId,
            nivel: input.nivel,
            precipitacaoAcumulada: input.precipitacaoAcumulada,
            dataReferencia: input.dataReferencia,
            observacoes: input.observacoes,
          },
          {},
        ),
    );

    await this.repository.bulkInsertRisco(riscos);
    return { count: riscos.length };
  }
}
