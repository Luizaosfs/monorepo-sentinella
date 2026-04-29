import { FocoRiscoReadRepository } from '@modules/foco-risco/repositories/foco-risco-read.repository';
import { FocoRiscoWriteRepository } from '@modules/foco-risco/repositories/foco-risco-write.repository';
import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { getAccessScope } from '@shared/security/access-scope.helpers';

import { CreateReinspecaoBody } from '../dtos/create-reinspecao.body';
import { Reinspecao } from '../entities/reinspecao';
import { ReinspecaoException } from '../errors/reinspecao.exception';
import { ReinspecaoWriteRepository } from '../repositories/reinspecao-write.repository';

@Injectable()
export class CriarManual {
  constructor(
    private repository: ReinspecaoWriteRepository,
    private focoReadRepository: FocoRiscoReadRepository,
    private focoWriteRepository: FocoRiscoWriteRepository,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute(input: CreateReinspecaoBody) {
    // MT-02: tenantId do guard sempre vence — nunca aceita clienteId do frontend
    const clienteId = getAccessScope(this.req).tenantId;
    if (!clienteId) {
      throw ReinspecaoException.payloadInvalido();
    }

    const isAdmin = this.req['user']?.isPlatformAdmin ?? false;
    if (
      input.clienteId &&
      !isAdmin &&
      input.clienteId !== getAccessScope(this.req).tenantId
    ) {
      throw ReinspecaoException.forbiddenTenant();
    }

    const foco = await this.focoReadRepository.findById(input.focoRiscoId, clienteId as string | null);
    if (!foco) {
      throw ReinspecaoException.focoNaoEncontrado();
    }

    const entity = new Reinspecao(
      {
        clienteId,
        focoRiscoId: input.focoRiscoId,
        status: 'pendente',
        tipo: input.tipo ?? 'eficacia_pos_tratamento',
        origem: 'manual',
        dataPrevista: input.dataPrevista,
        responsavelId: input.responsavelId,
        observacao: input.observacao,
        criadoPor: this.req['user']?.id,
      },
      {},
    );

    const created = await this.repository.create(entity);

    await this.focoWriteRepository.createHistorico({
      focoRiscoId: foco.id,
      clienteId: foco.clienteId,
      statusAnterior: foco.status,
      statusNovo: foco.status,
      tipoEvento: 'reinspecao_agendada',
      alteradoPor: this.req['user']?.id,
      motivo: [
        `Reinspeção agendada (manual). ID: ${created.id}.`,
        `Tipo: ${created.tipo}.`,
        `Data prevista: ${created.dataPrevista.toISOString()}.`,
      ].join(' '),
    });

    return { reinspecao: created };
  }
}
