import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { getAccessScope, getClienteIdsPermitidos } from '@shared/security/access-scope.helpers';

import { SlaReadRepository } from '../repositories/sla-read.repository';

@Injectable()
export class CountPendentes {
  constructor(
    private repository: SlaReadRepository,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute() {
    const clienteIds = getClienteIdsPermitidos(getAccessScope(this.req));
    const clienteId = clienteIds !== null ? (clienteIds[0] ?? null) : null;
    return this.repository.countPendentes(clienteId);
  }
}
