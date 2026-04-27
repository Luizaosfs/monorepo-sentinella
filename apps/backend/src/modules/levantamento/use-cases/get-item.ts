import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { LevantamentoException } from '../errors/levantamento.exception';
import { LevantamentoReadRepository } from '../repositories/levantamento-read.repository';

@Injectable()
export class GetItem {
  constructor(
    private readRepository: LevantamentoReadRepository,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute(itemId: string) {
    const tenantId = (this.req['tenantId'] as string | undefined) ?? null;
    const item = await this.readRepository.findItemById(itemId, tenantId);
    if (!item) throw LevantamentoException.itemNotFound();
    return { item };
  }
}
