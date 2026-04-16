import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';

import { PlanoAcaoException } from '../errors/plano-acao.exception';
import { PlanoAcaoReadRepository } from '../repositories/plano-acao-read.repository';
import { PlanoAcaoWriteRepository } from '../repositories/plano-acao-write.repository';

@Injectable()
export class DeletePlanoAcao {
  constructor(
    private readRepository: PlanoAcaoReadRepository,
    private writeRepository: PlanoAcaoWriteRepository,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute(id: string) {
    const tenantId = this.req['tenantId'] as string | undefined;
    if (!tenantId) {
      throw PlanoAcaoException.tenantRequired();
    }

    const existing = await this.readRepository.findById(id, tenantId);
    if (!existing) throw PlanoAcaoException.notFound();

    await this.writeRepository.delete(id, tenantId);
    return { deleted: true };
  }
}
