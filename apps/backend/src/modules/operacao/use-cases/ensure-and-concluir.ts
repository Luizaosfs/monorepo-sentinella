import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';

import { PrismaService } from 'src/shared/modules/database/prisma/prisma.service';

import { EnsureAndConcluirInput } from '../dtos/ensure-and-concluir.body';
import { Operacao } from '../entities/operacao';
import { OperacaoWriteRepository } from '../repositories/operacao-write.repository';

@Injectable()
export class EnsureAndConcluir {
  constructor(
    private prisma: PrismaService,
    private writeRepository: OperacaoWriteRepository,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute(data: EnsureAndConcluirInput) {
    const clienteId = this.req['tenantId'] as string;
    const now = new Date();

    const existing = await this.prisma.client.operacoes.findFirst({
      where: {
        cliente_id: clienteId,
        deleted_at: null,
        ...(data.itemLevantamentoId ? { item_levantamento_id: data.itemLevantamentoId } : {}),
        ...(data.focoRiscoId ? { foco_risco_id: data.focoRiscoId } : {}),
      },
    });

    if (!existing) {
      const operacao = new Operacao(
        {
          clienteId,
          status: 'concluido',
          iniciadoEm: now,
          concluidoEm: now,
          prioridade: data.prioridade ?? undefined,
          responsavelId: data.responsavelId ?? undefined,
          observacao: data.observacao ?? undefined,
          tipoVinculo: data.tipoVinculo ?? 'levantamento',
          itemLevantamentoId: data.itemLevantamentoId,
          focoRiscoId: data.focoRiscoId,
        },
        {},
      );
      const created = await this.writeRepository.create(operacao);
      return { operacao: created };
    }

    await this.prisma.client.operacoes.update({
      where: { id: existing.id },
      data: {
        status: 'concluido',
        iniciado_em: existing.iniciado_em ?? now,
        concluido_em: existing.concluido_em ?? now,
        updated_at: now,
      },
    });

    const updated = await this.prisma.client.operacoes.findUniqueOrThrow({
      where: { id: existing.id },
    });

    return {
      operacao: new Operacao(
        {
          clienteId: updated.cliente_id,
          status: updated.status ?? 'concluido',
          prioridade: updated.prioridade ?? undefined,
          responsavelId: updated.responsavel_id ?? undefined,
          observacao: updated.observacao ?? undefined,
          iniciadoEm: updated.iniciado_em ?? undefined,
          concluidoEm: updated.concluido_em ?? undefined,
          tipoVinculo: updated.tipo_vinculo ?? undefined,
          itemLevantamentoId: updated.item_levantamento_id ?? undefined,
          focoRiscoId: updated.foco_risco_id ?? undefined,
          regiaoId: updated.regiao_id ?? undefined,
        },
        { id: updated.id },
      ),
    };
  }
}
