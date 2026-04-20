import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { assertTenantOwnership } from 'src/shared/security/tenant-ownership.util';

import { NotificacaoException } from '../errors/notificacao.exception';
import { NotificacaoReadRepository } from '../repositories/notificacao-read.repository';
import { NotificacaoWriteRepository } from '../repositories/notificacao-write.repository';

@Injectable()
export class DeleteUnidade {
  constructor(
    private readRepository: NotificacaoReadRepository,
    private writeRepository: NotificacaoWriteRepository,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute(id: string): Promise<void> {
    const unidade = await this.readRepository.findUnidadeById(id);
    if (!unidade) throw NotificacaoException.unidadeNotFound();
    assertTenantOwnership(unidade.clienteId, this.req);
    await this.writeRepository.deleteUnidade(id);
  }
}
