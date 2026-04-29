import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';

import { getAccessScope, requireTenantId } from '@shared/security/access-scope.helpers';
import { CreateOperacaoBody } from '../dtos/create-operacao.body';
import { Operacao } from '../entities/operacao';
import { OperacaoWriteRepository } from '../repositories/operacao-write.repository';

@Injectable()
export class CreateOperacao {
  constructor(
    private repository: OperacaoWriteRepository,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute(data: CreateOperacaoBody) {
    const clienteId = requireTenantId(getAccessScope(this.req));

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
