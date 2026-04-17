import { FocoRiscoReadRepository } from '@modules/foco-risco/repositories/foco-risco-read.repository';
import { FocoRiscoWriteRepository } from '@modules/foco-risco/repositories/foco-risco-write.repository';
import { Inject, Injectable } from '@nestjs/common';
import { Request } from 'express';

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
    @Inject('REQUEST') private req: Request,
  ) {}

  async execute(input: CreateReinspecaoBody) {
    // MT-02: tenantId do guard sempre vence — nunca aceita clienteId do frontend
    const clienteId = this.req['tenantId'];
    if (!clienteId) {
      throw ReinspecaoException.payloadInvalido();
    }

    const isAdmin = this.req['user']?.papeis?.includes('admin');
    if (
      input.clienteId &&
      !isAdmin &&
      input.clienteId !== this.req['tenantId']
    ) {
      throw ReinspecaoException.forbiddenTenant();
    }

    const foco = await this.focoReadRepository.findById(input.focoRiscoId);
    if (!foco) {
      throw ReinspecaoException.focoNaoEncontrado();
    }
    if (foco.clienteId !== clienteId) {
      throw ReinspecaoException.forbiddenTenant();
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
