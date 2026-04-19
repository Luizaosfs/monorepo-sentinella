import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';

import { PrismaService } from 'src/shared/modules/database/prisma/prisma.service';

import { EnsureEmAndamentoInput } from '../dtos/ensure-em-andamento.body';
import { Operacao } from '../entities/operacao';
import { OperacaoWriteRepository } from '../repositories/operacao-write.repository';

@Injectable()
export class EnsureEmAndamento {
  constructor(
    private prisma: PrismaService,
    private writeRepository: OperacaoWriteRepository,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute(data: EnsureEmAndamentoInput) {
    const clienteId = this.req['tenantId'] as string;

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
          status: 'em_andamento',
          iniciadoEm: new Date(),
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

    if (existing.status !== 'em_andamento') {
      await this.prisma.client.operacoes.update({
        where: { id: existing.id },
        data: {
          status: 'em_andamento',
          iniciado_em: existing.iniciado_em ?? new Date(),
          updated_at: new Date(),
        },
      });
    }

    const updated = await this.prisma.client.operacoes.findUniqueOrThrow({
      where: { id: existing.id },
    });

    return {
      operacao: new Operacao(
        {
          clienteId: updated.cliente_id,
          status: updated.status ?? 'em_andamento',
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
