import { Inject, Injectable } from '@nestjs/common';
import { Request } from 'express';

import { UpsertPluvioRiscoInput } from '../dtos/upsert-pluvio-risco.body';
import { PluvioRisco } from '../entities/pluvio';
import { PluvioWriteRepository } from '../repositories/pluvio-write.repository';

@Injectable()
export class BulkInsertRisco {
  constructor(
    private repository: PluvioWriteRepository,
    @Inject('REQUEST') private req: Request,
  ) {}

  async execute(inputs: UpsertPluvioRiscoInput[]) {
    const createdBy = this.req['user']?.id;

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
          { createdBy },
        ),
    );

    await this.repository.bulkInsertRisco(riscos);
    return { count: riscos.length };
  }
}
