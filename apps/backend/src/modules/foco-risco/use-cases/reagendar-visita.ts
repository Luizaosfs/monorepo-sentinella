import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { getAccessScope } from '@shared/security/access-scope.helpers';
import type { AuthenticatedUser } from 'src/guards/auth.guard';

import { FocoRiscoException } from '../errors/foco-risco.exception';
import { FocoRiscoReadRepository } from '../repositories/foco-risco-read.repository';
import { FocoRiscoWriteRepository } from '../repositories/foco-risco-write.repository';

@Injectable()
export class ReagendarVisita {
  constructor(
    private readRepository: FocoRiscoReadRepository,
    private writeRepository: FocoRiscoWriteRepository,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute(id: string, motivo?: string) {
    const user = this.req['user'] as AuthenticatedUser;
    const tenantId = getAccessScope(this.req).tenantId;

    const foco = await this.readRepository.findById(id, tenantId);
    if (!foco) throw FocoRiscoException.notFound();

    if (foco.status !== 'aguardando_nova_tentativa') {
      throw FocoRiscoException.statusInvalido();
    }

    const statusAnterior = foco.status;
    foco.status = 'aguarda_inspecao';
    // Zera o contador para o agente poder fazer novas tentativas
    // O histórico de vistorias sem acesso permanece intacto
    foco.tentativasSemAcesso = 0;
    foco.pendentDecisaoSupervisor = false;

    await this.writeRepository.save(foco);

    await this.writeRepository.createHistorico({
      focoRiscoId: foco.id,
      clienteId: foco.clienteId,
      statusAnterior,
      statusNovo: 'aguarda_inspecao',
      alteradoPor: user?.id,
      motivo: motivo ?? 'Visita reagendada pelo supervisor',
      tipoEvento: 'reagendamento_supervisor',
    });

    return { foco };
  }
}
