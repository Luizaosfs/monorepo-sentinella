import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';

import { AtribuirAgenteInput } from '../dtos/atribuir-agente.body';
import { FocoRiscoException } from '../errors/foco-risco.exception';
import { FocoRiscoReadRepository } from '../repositories/foco-risco-read.repository';
import { FocoRiscoWriteRepository } from '../repositories/foco-risco-write.repository';

@Injectable()
export class AtribuirAgente {
  constructor(
    private readRepository: FocoRiscoReadRepository,
    private writeRepository: FocoRiscoWriteRepository,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute(id: string, input: AtribuirAgenteInput) {
    const tenantId = (this.req['tenantId'] as string | undefined) ?? null;
    const foco = await this.readRepository.findById(id, tenantId);
    if (!foco) throw FocoRiscoException.notFound();

    const responsavelAnterior = foco.responsavelId;
    foco.responsavelId = input.agenteId;

    await this.writeRepository.save(foco);

    const motivoPadrao = responsavelAnterior
      ? `Responsável alterado de ${responsavelAnterior} para ${input.agenteId}`
      : `Responsável atribuído: ${input.agenteId}`;

    await this.writeRepository.createHistorico({
      focoRiscoId: foco.id,
      clienteId: foco.clienteId,
      statusAnterior: foco.status,
      statusNovo: foco.status,
      alteradoPor: this.req['user']?.id,
      motivo: input.motivo ?? motivoPadrao,
      tipoEvento: 'atribuicao_responsavel',
    });

    return { foco };
  }

}
