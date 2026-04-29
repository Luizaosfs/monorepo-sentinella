import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { getAccessScope, getClienteIdsPermitidos } from '@shared/security/access-scope.helpers';
import { Request } from 'express';

import { OperacaoReadRepository } from '../repositories/operacao-read.repository';

@Injectable()
export class StatsOperacao {
  constructor(
    private repository: OperacaoReadRepository,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute() {
    const clienteIds = getClienteIdsPermitidos(getAccessScope(this.req));
    const clienteId = clienteIds !== null ? (clienteIds[0] ?? null) : null;
    const byStatus = await this.repository.countByStatus(clienteId);
    return { byStatus };
  }
}
