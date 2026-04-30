import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';

import { getAccessScope, requireTenantId } from '@shared/security/access-scope.helpers';
import { UpsertOperacaoInput } from '../dtos/upsert-operacao.body';
import { Operacao } from '../entities/operacao';
import { OperacaoException } from '../errors/operacao.exception';
import { OperacaoReadRepository } from '../repositories/operacao-read.repository';
import { OperacaoWriteRepository } from '../repositories/operacao-write.repository';
import { PrismaService } from 'src/shared/modules/database/prisma/prisma.service';

@Injectable()
export class UpsertOperacao {
  constructor(
    private readRepository: OperacaoReadRepository,
    private writeRepository: OperacaoWriteRepository,
    private prisma: PrismaService,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute(data: UpsertOperacaoInput) {
    const clienteId = requireTenantId(getAccessScope(this.req));

    if (data.responsavelId) {
      const count = await this.prisma.client.usuarios.count({
        where: { id: data.responsavelId, cliente_id: clienteId },
      });
      if (count === 0) throw new ForbiddenException('responsavelId não pertence a este cliente');
    }

    if (data.id) {
      const operacao = await this.readRepository.findById(data.id, clienteId);
      if (!operacao) throw OperacaoException.notFound();

      const antigo = operacao.status;
      operacao.status = data.status;
      if (data.status === 'em_andamento' && antigo === 'pendente') {
        operacao.iniciadoEm = new Date();
      }
      if (data.status === 'concluido' && !operacao.concluidoEm) {
        operacao.concluidoEm = new Date();
      }
      if (data.prioridade !== undefined) operacao.prioridade = data.prioridade ?? undefined;
      if (data.responsavelId !== undefined) operacao.responsavelId = data.responsavelId ?? undefined;
      if (data.observacao !== undefined) operacao.observacao = data.observacao ?? undefined;

      await this.writeRepository.save(operacao);
      return { operacao };
    }

    const operacao = new Operacao(
      {
        clienteId,
        status: data.status,
        prioridade: data.prioridade ?? undefined,
        responsavelId: data.responsavelId ?? undefined,
        observacao: data.observacao ?? undefined,
        iniciadoEm: data.status === 'em_andamento' ? new Date() : undefined,
      },
      {},
    );

    const created = await this.writeRepository.create(operacao);
    return { operacao: created };
  }
}
