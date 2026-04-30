import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { getAccessScope } from '@shared/security/access-scope.helpers';

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
    const tenantId = getAccessScope(this.req).tenantId;
    const unidade = await this.readRepository.findUnidadeById(id, tenantId);
    if (!unidade) throw NotificacaoException.unidadeNotFound();
    await this.writeRepository.deleteUnidade(id);
  }
}
