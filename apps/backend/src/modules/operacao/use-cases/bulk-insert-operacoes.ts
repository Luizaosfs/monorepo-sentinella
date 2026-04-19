import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';

import { BulkInsertOperacoesInput } from '../dtos/bulk-insert-operacoes.body';
import { Operacao } from '../entities/operacao';
import { OperacaoReadRepository } from '../repositories/operacao-read.repository';
import { OperacaoWriteRepository } from '../repositories/operacao-write.repository';

@Injectable()
export class BulkInsertOperacoes {
  constructor(
    private readRepository: OperacaoReadRepository,
    private writeRepository: OperacaoWriteRepository,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute(data: BulkInsertOperacoesInput) {
    const clienteId = this.req['tenantId'] as string;
    const created: Operacao[] = [];
    let skipped = 0;

    for (const row of data.operacoes) {
      const existente = await this.readRepository.findAtivaParaItem(
        clienteId,
        row.itemLevantamentoId,
      );
      if (existente) {
        skipped++;
        continue;
      }

      const operacao = new Operacao(
        {
          clienteId,
          status: row.status ?? 'pendente',
          prioridade: row.prioridade ?? undefined,
          responsavelId: row.responsavelId ?? undefined,
          observacao: row.observacao ?? undefined,
          tipoVinculo: row.tipoVinculo ?? 'levantamento',
          itemLevantamentoId: row.itemLevantamentoId,
        },
        {},
      );

      const result = await this.writeRepository.create(operacao);
      created.push(result);
    }

    return { operacoes: created, skipped };
  }
}
