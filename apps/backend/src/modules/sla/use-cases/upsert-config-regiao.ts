import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';

import { SaveConfigBody } from '../dtos/save-config.body';
import { SlaWriteRepository } from '../repositories/sla-write.repository';

@Injectable()
export class UpsertConfigRegiao {
  constructor(
    private repository: SlaWriteRepository,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute(regiaoId: string, data: SaveConfigBody) {
    const clienteId = this.req['tenantId'] as string;
    await this.repository.upsertConfigRegiao(clienteId, regiaoId, data.config);
    return { updated: true };
  }
}
