import { Injectable } from '@nestjs/common';

import { UpsertPluvioRiscoInput } from '../dtos/upsert-pluvio-risco.body';
import { PluvioRisco } from '../entities/pluvio';
import { PluvioWriteRepository } from '../repositories/pluvio-write.repository';

@Injectable()
export class UpsertRisco {
  constructor(private repository: PluvioWriteRepository) {}

  async execute(input: UpsertPluvioRiscoInput) {
    const risco = new PluvioRisco(
      {
        regiaoId: input.regiaoId,
        nivel: input.nivel,
        precipitacaoAcumulada: input.precipitacaoAcumulada,
        dataReferencia: input.dataReferencia,
        observacoes: input.observacoes,
      },
      { id: input.id },
    );

    const upserted = await this.repository.upsertRisco(risco);
    return { risco: upserted };
  }
}
