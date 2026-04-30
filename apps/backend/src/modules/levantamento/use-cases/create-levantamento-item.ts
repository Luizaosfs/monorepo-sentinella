import { Inject, Injectable, Logger, Scope } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { getAccessScope } from '@shared/security/access-scope.helpers';

import { CriarFocoDeLevantamentoItem } from '@/modules/foco-risco/use-cases/auto-criacao/criar-foco-de-levantamento-item';
import { QuotaException } from '../../billing/errors/quota.exception';
import { VerificarQuota } from '../../billing/use-cases/verificar-quota';

import { CreateLevantamentoItemBody } from '../dtos/create-levantamento-item.body';
import { LevantamentoException } from '../errors/levantamento.exception';
import { LevantamentoReadRepository } from '../repositories/levantamento-read.repository';
import { LevantamentoWriteRepository } from '../repositories/levantamento-write.repository';

@Injectable({ scope: Scope.REQUEST })
export class CreateLevantamentoItem {
  private readonly logger = new Logger(CreateLevantamentoItem.name);

  constructor(
    private readRepository: LevantamentoReadRepository,
    private writeRepository: LevantamentoWriteRepository,
    private criarFocoDeLevantamentoItem: CriarFocoDeLevantamentoItem,
    private verificarQuota: VerificarQuota,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute(levantamentoId: string, input: CreateLevantamentoItemBody) {
    const tenantId = getAccessScope(this.req).tenantId;
    const levantamento = await this.readRepository.findById(levantamentoId, tenantId);
    if (!levantamento) throw LevantamentoException.notFound();

    const { ok, usado, limite, motivo } = await this.verificarQuota.execute(
      levantamento.clienteId,
      { metrica: 'itens_mes' },
    );
    if (!ok) throw QuotaException.excedida({ metrica: 'itens_mes', usado, limite, motivo });

    const item = await this.writeRepository.createItem({
      levantamentoId,
      latitude: input.latitude,
      longitude: input.longitude,
      item: input.item,
      risco: input.risco,
      acao: input.acao,
      scoreFinal: input.scoreFinal,
      prioridade: input.prioridade,
      slaHoras: input.slaHoras,
      enderecoCurto: input.enderecoCurto,
      enderecoCompleto: input.enderecoCompleto,
      imageUrl: input.imageUrl,
      maps: input.maps,
      waze: input.waze,
      dataHora: input.dataHora,
      peso: input.peso,
      payload: input.payload,
      imagePublicId: input.imagePublicId,
    });

    if (item.id) {
      try {
        await this.criarFocoDeLevantamentoItem.execute({
          clienteId: levantamento.clienteId,
          itemId: item.id,
          levantamentoId,
          latitude: item.latitude ?? null,
          longitude: item.longitude ?? null,
          prioridade: item.prioridade ?? null,
          risco: item.risco ?? null,
          enderecoCurto: item.enderecoCurto ?? null,
          payload: (item.payload ?? null) as Record<string, unknown> | null,
          createdAt: item.createdAt ?? new Date(),
        });
      } catch (err) {
        this.logger.error(
          `Hook CriarFocoDeLevantamentoItem falhou: item=${item.id} erro=${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }

    return { item };
  }
}
