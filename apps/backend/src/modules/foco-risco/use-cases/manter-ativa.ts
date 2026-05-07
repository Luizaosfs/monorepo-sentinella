import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';
import { Request } from 'express';
import { getAccessScope } from '@shared/security/access-scope.helpers';
import type { AuthenticatedUser } from 'src/guards/auth.guard';

import { FocoRiscoException } from '../errors/foco-risco.exception';
import { FocoRiscoReadRepository } from '../repositories/foco-risco-read.repository';
import { FocoRiscoWriteRepository } from '../repositories/foco-risco-write.repository';

@Injectable()
export class ManterAtiva {
  constructor(
    private readRepository: FocoRiscoReadRepository,
    private writeRepository: FocoRiscoWriteRepository,
    private prisma: PrismaService,
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

    const statusAtual = foco.status;
    foco.pendentDecisaoSupervisor = false;

    await this.prisma.client.$transaction(async (tx) => {
      await this.writeRepository.save(foco, tx);
      await this.writeRepository.createHistorico({
        focoRiscoId: foco.id,
        clienteId: foco.clienteId,
        statusAnterior: statusAtual,
        statusNovo: statusAtual,
        alteradoPor: user?.id,
        motivo: motivo ?? 'Ocorrência mantida ativa pelo supervisor',
        tipoEvento: 'manter_ativa_supervisor',
      }, tx);
    });

    return { foco };
  }
}
