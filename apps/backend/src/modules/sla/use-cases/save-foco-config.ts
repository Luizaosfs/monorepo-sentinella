import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';

import { SaveFocoConfigBody } from '../dtos/save-foco-config.body';
import { SlaWriteRepository } from '../repositories/sla-write.repository';

@Injectable()
export class SaveFocoConfig {
  constructor(
    private repository: SlaWriteRepository,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute(data: SaveFocoConfigBody) {
    const clienteId = this.req['tenantId'] as string;
    const configs = await this.repository.upsertFocoConfig(
      clienteId,
      data.configs,
    );
    return { configs };
  }
}
