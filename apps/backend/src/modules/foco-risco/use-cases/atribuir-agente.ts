import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { getAccessScope } from '@shared/security/access-scope.helpers';

import { AtribuirAgenteInput } from '../dtos/atribuir-agente.body';
import { FocoRiscoException } from '../errors/foco-risco.exception';
import { FocoRiscoReadRepository } from '../repositories/foco-risco-read.repository';
import { FocoRiscoWriteRepository } from '../repositories/foco-risco-write.repository';
import { PrismaService } from 'src/shared/modules/database/prisma/prisma.service';

@Injectable()
export class AtribuirAgente {
  constructor(
    private readRepository: FocoRiscoReadRepository,
    private writeRepository: FocoRiscoWriteRepository,
    private prisma: PrismaService,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute(id: string, input: AtribuirAgenteInput) {
    const tenantId = getAccessScope(this.req).tenantId;
    const foco = await this.readRepository.findById(id, tenantId);
    if (!foco) throw FocoRiscoException.notFound();

    if (input.agenteId && tenantId) {
      const count = await this.prisma.client.usuarios.count({
        where: { id: input.agenteId, cliente_id: tenantId },
      });
      if (count === 0) throw new ForbiddenException('agenteId não pertence a este cliente');
    }

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
