import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { getAccessScope, requireTenantId } from '@shared/security/access-scope.helpers';

import { SaveConfigBody } from '../dtos/save-config.body';
import { SlaWriteRepository } from '../repositories/sla-write.repository';

@Injectable()
export class UpsertConfigRegiao {
  constructor(
    private repository: SlaWriteRepository,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute(regiaoId: string, data: SaveConfigBody) {
    const clienteId = requireTenantId(getAccessScope(this.req));
    await this.repository.upsertConfigRegiao(clienteId, regiaoId, data.config);
    return { updated: true };
  }
}
