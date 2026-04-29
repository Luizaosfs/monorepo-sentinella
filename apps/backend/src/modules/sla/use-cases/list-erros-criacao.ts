import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { getAccessScope, requireTenantId } from '@shared/security/access-scope.helpers';

import { SlaReadRepository } from '../repositories/sla-read.repository';

@Injectable()
export class ListErrosCriacao {
  constructor(
    private repository: SlaReadRepository,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute() {
    const clienteId = requireTenantId(getAccessScope(this.req));
    const erros = await this.repository.findErrosCriacao(clienteId, 20);
    return { erros };
  }
}
