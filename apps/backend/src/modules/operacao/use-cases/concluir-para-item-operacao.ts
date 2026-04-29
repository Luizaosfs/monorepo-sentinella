import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';

import { getAccessScope, requireTenantId } from '@shared/security/access-scope.helpers';
import { ConcluirParaItemInput } from '../dtos/concluir-para-item-operacao.body';
import { OperacaoException } from '../errors/operacao.exception';
import { OperacaoReadRepository } from '../repositories/operacao-read.repository';
import { OperacaoWriteRepository } from '../repositories/operacao-write.repository';

@Injectable()
export class ConcluirParaItemOperacao {
  constructor(
    private readRepository: OperacaoReadRepository,
    private writeRepository: OperacaoWriteRepository,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute(data: ConcluirParaItemInput) {
    const clienteId = requireTenantId(getAccessScope(this.req));

    const operacao = await this.readRepository.findAtivaParaItem(
      clienteId,
      data.itemLevantamentoId,
    );
    if (!operacao) throw OperacaoException.notFound();

    operacao.status = 'concluido';
    if (!operacao.concluidoEm) operacao.concluidoEm = new Date();
    if (data.observacao) operacao.observacao = data.observacao;

    await this.writeRepository.save(operacao);
    return { operacao };
  }
}
