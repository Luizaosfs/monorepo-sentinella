import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { AuthenticatedUser } from 'src/guards/auth.guard';

import { LevantamentoException } from '../errors/levantamento.exception';
import { LevantamentoReadRepository } from '../repositories/levantamento-read.repository';
import { LevantamentoWriteRepository } from '../repositories/levantamento-write.repository';

@Injectable()
export class DeleteItem {
  constructor(
    private readRepository: LevantamentoReadRepository,
    private writeRepository: LevantamentoWriteRepository,
    @Inject(REQUEST) private req: Request,
  ) {}

  private assertTenant(clienteId: string | undefined): void {
    const user = this.req['user'] as AuthenticatedUser | undefined;
    if (user?.isPlatformAdmin) return;
    const tenantId = this.req['tenantId'] as string | undefined;
    if (!tenantId || clienteId !== tenantId) {
      throw new ForbiddenException('Acesso negado: recurso pertence a outro tenant');
    }
  }

  async execute(itemId: string) {
    const item = await this.readRepository.findItemById(itemId);
    if (!item) throw LevantamentoException.itemNotFound();
    this.assertTenant(item.clienteId);
    await this.writeRepository.deleteItem(itemId);
  }
}
