import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';

import { CriarParaItemBody } from '../dtos/criar-para-item.body';
import { Operacao } from '../entities/operacao';
import { OperacaoException } from '../errors/operacao.exception';
import { OperacaoReadRepository } from '../repositories/operacao-read.repository';
import { OperacaoWriteRepository } from '../repositories/operacao-write.repository';

@Injectable()
export class CriarParaItem {
  constructor(
    private readRepository: OperacaoReadRepository,
    private writeRepository: OperacaoWriteRepository,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute(data: CriarParaItemBody) {
    const clienteId = this.req['tenantId'] as string;

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
