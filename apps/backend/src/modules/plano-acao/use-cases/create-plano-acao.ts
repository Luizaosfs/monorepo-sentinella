import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';

import { CreatePlanoAcaoBody } from '../dtos/create-plano-acao.body';
import { PlanoAcao } from '../entities/plano-acao';
import { PlanoAcaoException } from '../errors/plano-acao.exception';
import { PlanoAcaoWriteRepository } from '../repositories/plano-acao-write.repository';

@Injectable()
export class CreatePlanoAcao {
  constructor(
    private repository: PlanoAcaoWriteRepository,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute(data: CreatePlanoAcaoBody) {
    // MT-02: tenantId do guard sempre vence — nunca aceita clienteId do frontend
    const clienteId = this.req['tenantId'] as string | undefined;
    if (!clienteId) {
      throw PlanoAcaoException.tenantRequired();
    }

    const planoAcao = new PlanoAcao(
      {
        clienteId,
        label: data.label,
        descricao: data.descricao,
        tipoItem: data.tipoItem,
        ativo: data.ativo ?? true,
        ordem: data.ordem ?? 0,
      },
      { createdBy: this.req['user']?.id },
    );

    const created = await this.repository.create(planoAcao);
    return { planoAcao: created };
  }
}
