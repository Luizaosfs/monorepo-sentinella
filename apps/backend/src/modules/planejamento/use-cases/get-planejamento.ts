import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { getAccessScope } from '@shared/security/access-scope.helpers';

import { PlanejamentoException } from '../errors/planejamento.exception';
import { PlanejamentoReadRepository } from '../repositories/planejamento-read.repository';

@Injectable()
export class GetPlanejamento {
  constructor(
    private repository: PlanejamentoReadRepository,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute(id: string) {
    const tenantId = getAccessScope(this.req).tenantId;
    const planejamento = await this.repository.findById(id, tenantId);
    if (!planejamento) throw PlanejamentoException.notFound();
    return { planejamento };
  }
}
