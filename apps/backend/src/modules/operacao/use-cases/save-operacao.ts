import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { getAccessScope, requireTenantId } from '@shared/security/access-scope.helpers';
import { SaveOperacaoBody } from '../dtos/save-operacao.body';
import { OperacaoException } from '../errors/operacao.exception';
import { OperacaoReadRepository } from '../repositories/operacao-read.repository';
import { OperacaoWriteRepository } from '../repositories/operacao-write.repository';
import { PrismaService } from 'src/shared/modules/database/prisma/prisma.service';

@Injectable()
export class SaveOperacao {
  constructor(
    private readRepository: OperacaoReadRepository,
    private writeRepository: OperacaoWriteRepository,
    private prisma: PrismaService,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute(id: string, data: SaveOperacaoBody) {
    const clienteId = requireTenantId(getAccessScope(this.req));
    const operacao = await this.readRepository.findById(id, clienteId);
    if (!operacao) throw OperacaoException.notFound();

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
    if (data.responsavelId !== undefined) {
      if (data.responsavelId) {
        const count = await this.prisma.client.usuarios.count({
          where: { id: data.responsavelId, cliente_id: clienteId },
        });
        if (count === 0) throw new ForbiddenException('responsavelId não pertence a este cliente');
      }
      operacao.responsavelId = data.responsavelId;
    }
    if (data.observacao !== undefined) operacao.observacao = data.observacao;

    await this.writeRepository.save(operacao);
    return { operacao };
  }
}
