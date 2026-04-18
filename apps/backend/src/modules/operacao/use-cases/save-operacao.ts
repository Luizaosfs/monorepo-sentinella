import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { AuthenticatedUser } from 'src/guards/auth.guard';

import { SaveOperacaoBody } from '../dtos/save-operacao.body';
import { OperacaoException } from '../errors/operacao.exception';
import { OperacaoReadRepository } from '../repositories/operacao-read.repository';
import { OperacaoWriteRepository } from '../repositories/operacao-write.repository';

@Injectable()
export class SaveOperacao {
  constructor(
    private readRepository: OperacaoReadRepository,
    private writeRepository: OperacaoWriteRepository,
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

  async execute(id: string, data: SaveOperacaoBody) {
    const operacao = await this.readRepository.findById(id);
    if (!operacao) throw OperacaoException.notFound();
    this.assertTenant(operacao.clienteId);

    if (data.status !== undefined) {
      const antigo = operacao.status;
      operacao.status = data.status;
      if (data.status === 'em_andamento' && antigo === 'pendente') {
        operacao.iniciadoEm = new Date();
      }
      if (data.status === 'concluido' && !operacao.concluidoEm) {
        operacao.concluidoEm = new Date();
      }
    }
    if (data.prioridade !== undefined) operacao.prioridade = data.prioridade;
    if (data.responsavelId !== undefined)
      operacao.responsavelId = data.responsavelId;
    if (data.observacao !== undefined) operacao.observacao = data.observacao;

    await this.writeRepository.save(operacao);
    return { operacao };
  }
}
