import { Inject, Injectable, Scope } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';

import { UpsertPluvioRiscoInput } from '../dtos/upsert-pluvio-risco.body';
import { PluvioRisco } from '../entities/pluvio';
import { PluvioWriteRepository } from '../repositories/pluvio-write.repository';

@Injectable({ scope: Scope.REQUEST })
export class UpsertRisco {
  constructor(
    private repository: PluvioWriteRepository,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute(input: UpsertPluvioRiscoInput) {
    const risco = new PluvioRisco(
      {
        regiaoId: input.regiaoId,
        nivel: input.nivel,
        precipitacaoAcumulada: input.precipitacaoAcumulada,
        dataReferencia: input.dataReferencia,
        observacoes: input.observacoes,
      },
      {
        id: input.id,
        createdBy: this.req['user']?.id,
      },
    );

    const upserted = await this.repository.upsertRisco(risco);
    return { risco: upserted };
  }
}
