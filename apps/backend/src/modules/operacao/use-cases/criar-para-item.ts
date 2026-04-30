import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';

import { getAccessScope, requireTenantId } from '@shared/security/access-scope.helpers';
import { CriarParaItemBody } from '../dtos/criar-para-item.body';
import { Operacao } from '../entities/operacao';
import { OperacaoException } from '../errors/operacao.exception';
import { OperacaoReadRepository } from '../repositories/operacao-read.repository';
import { OperacaoWriteRepository } from '../repositories/operacao-write.repository';
import { PrismaService } from 'src/shared/modules/database/prisma/prisma.service';

@Injectable()
export class CriarParaItem {
  constructor(
    private readRepository: OperacaoReadRepository,
    private writeRepository: OperacaoWriteRepository,
    private prisma: PrismaService,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute(data: CriarParaItemBody) {
    const clienteId = requireTenantId(getAccessScope(this.req));

    const itemCount = await this.prisma.client.levantamento_itens.count({
      where: { id: data.itemLevantamentoId, cliente_id: clienteId },
    });
    if (itemCount === 0) throw new ForbiddenException('itemLevantamentoId inválido para este cliente');

    if (data.responsavelId) {
      const count = await this.prisma.client.usuarios.count({
        where: { id: data.responsavelId, cliente_id: clienteId },
      });
      if (count === 0) throw new ForbiddenException('responsavelId não pertence a este cliente');
    }

    const existente = await this.readRepository.findAtivaParaItem(
      clienteId,
      data.itemLevantamentoId,
    );
    if (existente) throw OperacaoException.alreadyExists();

    const operacao = new Operacao(
      {
        clienteId,
        status: 'pendente',
        prioridade: data.prioridade,
        responsavelId: data.responsavelId,
        observacao: data.observacao,
        tipoVinculo: 'levantamento',
        itemLevantamentoId: data.itemLevantamentoId,
      },
      {},
    );

    const created = await this.writeRepository.create(operacao);
    return { operacao: created };
  }
}
