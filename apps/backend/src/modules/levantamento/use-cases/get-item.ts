import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { getAccessScope } from '@shared/security/access-scope.helpers';
import { LevantamentoException } from '../errors/levantamento.exception';
import { LevantamentoReadRepository } from '../repositories/levantamento-read.repository';

@Injectable()
export class GetItem {
  constructor(
    private readRepository: LevantamentoReadRepository,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute(itemId: string) {
    const tenantId = getAccessScope(this.req).tenantId;
    const item = await this.readRepository.findItemById(itemId, tenantId);
    if (!item) throw LevantamentoException.itemNotFound();
    return { item };
  }
}
