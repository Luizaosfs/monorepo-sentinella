import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';

import { CreatePlanejamentoBody } from '../dtos/create-planejamento.body';
import { Planejamento } from '../entities/planejamento';
import { PlanejamentoWriteRepository } from '../repositories/planejamento-write.repository';

@Injectable()
export class CreatePlanejamento {
  constructor(
    private repository: PlanejamentoWriteRepository,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute(data: CreatePlanejamentoBody) {
    const clienteId = (data.clienteId ?? this.req['tenantId']) as string;

    const planejamento = new Planejamento(
      {
        descricao: data.descricao,
        dataPlanejamento: data.dataPlanejamento ?? new Date(),
        clienteId,
        areaTotal: data.areaTotal,
        alturaVoo: data.alturaVoo,
        tipo: data.tipo,
        ativo: data.ativo ?? false,
        tipoEntrada: data.tipoEntrada,
        tipoLevantamento: data.tipoLevantamento ?? 'MANUAL',
        regiaoId: data.regiaoId,
      },
      {},
    );

    const created = await this.repository.create(planejamento);
    return { planejamento: created };
  }
}
