import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';

import { getAccessScope, requireTenantId } from '@shared/security/access-scope.helpers';
import { CreateOperacaoBody } from '../dtos/create-operacao.body';
import { Operacao } from '../entities/operacao';
import { OperacaoWriteRepository } from '../repositories/operacao-write.repository';
import { PrismaService } from 'src/shared/modules/database/prisma/prisma.service';

@Injectable()
export class CreateOperacao {
  constructor(
    private repository: OperacaoWriteRepository,
    private prisma: PrismaService,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute(data: CreateOperacaoBody) {
    const clienteId = requireTenantId(getAccessScope(this.req));

    if (data.focoRiscoId) {
      const count = await this.prisma.client.focos_risco.count({
        where: { id: data.focoRiscoId, cliente_id: clienteId },
      });
      if (count === 0) throw new ForbiddenException('focoRiscoId inválido para este cliente');
    }
    if (data.itemLevantamentoId) {
      const count = await this.prisma.client.levantamento_itens.count({
        where: { id: data.itemLevantamentoId, cliente_id: clienteId },
      });
      if (count === 0) throw new ForbiddenException('itemLevantamentoId inválido para este cliente');
    }
    if (data.regiaoId) {
      const count = await this.prisma.client.regioes.count({
        where: { id: data.regiaoId, cliente_id: clienteId },
      });
      if (count === 0) throw new ForbiddenException('regiaoId inválido para este cliente');
    }
    if (data.responsavelId) {
      const count = await this.prisma.client.usuarios.count({
        where: { id: data.responsavelId, cliente_id: clienteId },
      });
      if (count === 0) throw new ForbiddenException('responsavelId não pertence a este cliente');
    }

    const operacao = new Operacao(
      {
        clienteId,
        status: data.status ?? 'pendente',
        prioridade: data.prioridade,
        responsavelId: data.responsavelId,
        observacao: data.observacao,
        tipoVinculo: data.tipoVinculo,
        itemOperacionalId: data.itemOperacionalId,
        itemLevantamentoId: data.itemLevantamentoId,
        regiaoId: data.regiaoId,
        focoRiscoId: data.focoRiscoId,
        iniciadoEm: data.status === 'em_andamento' ? new Date() : undefined,
      },
      {},
    );

    const created = await this.repository.create(operacao);
    return { operacao: created };
  }
}
