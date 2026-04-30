import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { getAccessScope, requireTenantId } from '@shared/security/access-scope.helpers';

import { PlanejamentoReadRepository } from '../repositories/planejamento-read.repository';

@Injectable()
export class GetAtivos {
  constructor(
    private repository: PlanejamentoReadRepository,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute() {
    const clienteId = requireTenantId(getAccessScope(this.req));
    const planejamentos = await this.repository.findAtivos(clienteId);
    return { planejamentos };
  }
}
