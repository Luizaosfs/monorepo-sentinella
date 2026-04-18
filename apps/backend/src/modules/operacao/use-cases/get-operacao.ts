import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { AuthenticatedUser } from 'src/guards/auth.guard';

import { OperacaoException } from '../errors/operacao.exception';
import { OperacaoReadRepository } from '../repositories/operacao-read.repository';

@Injectable()
export class GetOperacao {
  constructor(
    private repository: OperacaoReadRepository,
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

  async execute(id: string) {
    const operacao = await this.repository.findByIdComEvidencias(id);
    if (!operacao) throw OperacaoException.notFound();
    this.assertTenant(operacao.clienteId);
    return { operacao };
  }
}
