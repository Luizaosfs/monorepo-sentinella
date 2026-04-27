import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { AuthenticatedUser } from 'src/guards/auth.guard';

import { PlanejamentoException } from '../errors/planejamento.exception';
import { PlanejamentoReadRepository } from '../repositories/planejamento-read.repository';
import { PlanejamentoWriteRepository } from '../repositories/planejamento-write.repository';

@Injectable()
export class DeletePlanejamento {
  constructor(
    private readRepository: PlanejamentoReadRepository,
    private writeRepository: PlanejamentoWriteRepository,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute(id: string) {
    const tenantId = (this.req['tenantId'] as string | undefined) ?? null;
    const planejamento = await this.readRepository.findById(id, tenantId);
    if (!planejamento) throw PlanejamentoException.notFound();

    const userId = (this.req['user'] as AuthenticatedUser).id;
    await this.writeRepository.softDelete(id, userId);
    return { deleted: true };
  }
}
