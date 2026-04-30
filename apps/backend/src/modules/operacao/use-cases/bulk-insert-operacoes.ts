import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';

import { getAccessScope, requireTenantId } from '@shared/security/access-scope.helpers';
import { BulkInsertOperacoesInput } from '../dtos/bulk-insert-operacoes.body';
import { Operacao } from '../entities/operacao';
import { OperacaoReadRepository } from '../repositories/operacao-read.repository';
import { OperacaoWriteRepository } from '../repositories/operacao-write.repository';
import { PrismaService } from 'src/shared/modules/database/prisma/prisma.service';

@Injectable()
export class BulkInsertOperacoes {
  constructor(
    private readRepository: OperacaoReadRepository,
    private writeRepository: OperacaoWriteRepository,
    private prisma: PrismaService,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute(data: BulkInsertOperacoesInput) {
    const clienteId = requireTenantId(getAccessScope(this.req));
    const created: Operacao[] = [];
    let skipped = 0;

    const uniqueItemIds = [...new Set(data.operacoes.map((r) => r.itemLevantamentoId).filter(Boolean))];
    if (uniqueItemIds.length > 0) {
      const valid = await this.prisma.client.levantamento_itens.count({
        where: { id: { in: uniqueItemIds }, cliente_id: clienteId },
      });
      if (valid !== uniqueItemIds.length)
        throw new ForbiddenException('itemLevantamentoId inválido para este cliente');
    }

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
