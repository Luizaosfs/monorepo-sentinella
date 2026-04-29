import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { AuthenticatedUser } from 'src/guards/auth.guard';
import { getAccessScope, requireTenantId } from '@shared/security/access-scope.helpers';

import type { JsonObject } from '@shared/types/json';

import { SaveConfigBody } from '../dtos/save-config.body';
import { SlaReadRepository } from '../repositories/sla-read.repository';
import { SlaWriteRepository } from '../repositories/sla-write.repository';

@Injectable()
export class SaveConfig {
  constructor(
    private readRepository: SlaReadRepository,
    private writeRepository: SlaWriteRepository,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute(data: SaveConfigBody) {
    const clienteId = requireTenantId(getAccessScope(this.req));
    const changedBy = (this.req['user'] as AuthenticatedUser).id;

    const current = await this.readRepository.findConfig(clienteId);

    const config = await this.writeRepository.upsertConfig(clienteId, data.config);

    await this.writeRepository.createConfigAudit({
      clienteId,
      changedBy,
      action: current ? 'update' : 'create',
      configBefore: current?.config as JsonObject | undefined,
      configAfter: data.config,
    });

    return { config };
  }
}
