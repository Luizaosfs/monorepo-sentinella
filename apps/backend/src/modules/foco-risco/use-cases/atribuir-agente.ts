import { Inject, Injectable } from '@nestjs/common';
import { Request } from 'express';
import type { AuthenticatedUser } from 'src/guards/auth.guard';

import { AtribuirAgenteInput } from '../dtos/atribuir-agente.body';
import { FocoRisco } from '../entities/foco-risco';
import { FocoRiscoException } from '../errors/foco-risco.exception';
import { FocoRiscoReadRepository } from '../repositories/foco-risco-read.repository';
import { FocoRiscoWriteRepository } from '../repositories/foco-risco-write.repository';

@Injectable()
export class AtribuirAgente {
  constructor(
    private readRepository: FocoRiscoReadRepository,
    private writeRepository: FocoRiscoWriteRepository,
    @Inject('REQUEST') private req: Request,
  ) {}

  async execute(id: string, input: AtribuirAgenteInput) {
    const foco = await this.readRepository.findById(id);
    if (!foco) throw FocoRiscoException.notFound();

    this.assertFocoDoTenant(foco);

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

  private assertFocoDoTenant(foco: FocoRisco) {
    const user = this.req['user'] as AuthenticatedUser | undefined;
    const tenantId = this.req['tenantId'] as string | undefined;
    if (user?.papeis?.includes('admin')) return;
    if (!tenantId || foco.clienteId !== tenantId) {
      throw FocoRiscoException.notFound();
    }
  }
}
