import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { assertTenantOwnership } from 'src/shared/security/tenant-ownership.util';

import { LevantamentoException } from '../errors/levantamento.exception';
import { LevantamentoReadRepository } from '../repositories/levantamento-read.repository';

@Injectable()
export class GetItem {
  constructor(
    private readRepository: LevantamentoReadRepository,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute(itemId: string) {
    const item = await this.readRepository.findItemById(itemId);
    if (!item) throw LevantamentoException.itemNotFound();
    assertTenantOwnership(item.clienteId, this.req);
    return { item };
  }
}
