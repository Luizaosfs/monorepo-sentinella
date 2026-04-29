import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { getAccessScope, requireTenantId } from '@shared/security/access-scope.helpers';

import { SlaReadRepository } from '../repositories/sla-read.repository';

@Injectable()
export class ListSlaPainel {
  constructor(
    private repository: SlaReadRepository,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute(agenteId?: string) {
    const clienteId = requireTenantId(getAccessScope(this.req));
    const slas = await this.repository.findPainel(clienteId, agenteId);
    return { slas };
  }
}
