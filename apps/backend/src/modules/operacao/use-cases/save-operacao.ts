import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { assertTenantOwnership } from 'src/shared/security/tenant-ownership.util';

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

  async execute(id: string, data: SaveOperacaoBody) {
    const operacao = await this.readRepository.findById(id);
    if (!operacao) throw OperacaoException.notFound();
    assertTenantOwnership(operacao.clienteId, this.req);

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
