import { Inject, Injectable } from '@nestjs/common';
import { Request } from 'express';

import { CreateLevantamentoBody } from '../dtos/create-levantamento.body';
import { Levantamento } from '../entities/levantamento';
import { LevantamentoWriteRepository } from '../repositories/levantamento-write.repository';

@Injectable()
export class CreateLevantamento {
  constructor(
    private repository: LevantamentoWriteRepository,
    @Inject('REQUEST') private req: Request,
  ) {}

  async execute(input: CreateLevantamentoBody) {
    const levantamento = new Levantamento(
      {
        clienteId: this.req['tenantId'],
        usuarioId: this.req['user']?.id as string,
        cicloId: input.cicloId,
        observacao: input.observacao,
        statusProcessamento: 'aguardando',
        totalItens: 0,
      },
      { createdBy: this.req['user']?.id },
    );

    const created = await this.repository.create(levantamento);
    return { levantamento: created };
  }
}
