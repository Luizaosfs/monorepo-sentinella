import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';

import { AddItemEvidenciaBody } from '../dtos/add-item-evidencia.body';
import { LevantamentoException } from '../errors/levantamento.exception';
import {
  ItemEvidencia,
  LevantamentoReadRepository,
} from '../repositories/levantamento-read.repository';
import { LevantamentoWriteRepository } from '../repositories/levantamento-write.repository';

@Injectable()
export class AddItemEvidencia {
  constructor(
    private readRepository: LevantamentoReadRepository,
    private writeRepository: LevantamentoWriteRepository,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute(itemId: string, input: AddItemEvidenciaBody) {
    const tenantId = (this.req['tenantId'] as string | undefined) ?? null;
    const item = await this.readRepository.findItemById(itemId, tenantId);
    if (!item) throw LevantamentoException.itemNotFound();
    const evidencia = await this.writeRepository.addItemEvidencia(itemId, input);
    return { evidencia };
  }

  async listEvidencias(itemId: string): Promise<ItemEvidencia[]> {
    return this.readRepository.findItemEvidencias(itemId);
  }
}
