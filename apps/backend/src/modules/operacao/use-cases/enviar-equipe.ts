import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';

import { CreateOperacaoBody } from '../dtos/create-operacao.body';
import { Operacao } from '../entities/operacao';
import { OperacaoWriteRepository } from '../repositories/operacao-write.repository';

@Injectable()
export class EnviarEquipe {
  constructor(
    private repository: OperacaoWriteRepository,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute(data: CreateOperacaoBody) {
    const clienteId = (data.clienteId ?? this.req['tenantId']) as string;

    const operacao = new Operacao(
      {
        clienteId,
        status: 'em_andamento',
        prioridade: data.prioridade,
        responsavelId: data.responsavelId,
        observacao: data.observacao,
        tipoVinculo: data.tipoVinculo,
        itemOperacionalId: data.itemOperacionalId,
        itemLevantamentoId: data.itemLevantamentoId,
        regiaoId: data.regiaoId,
        focoRiscoId: data.focoRiscoId,
        iniciadoEm: new Date(),
      },
      {},
    );

    const created = await this.repository.create(operacao);
    return { operacao: created };
  }
}
