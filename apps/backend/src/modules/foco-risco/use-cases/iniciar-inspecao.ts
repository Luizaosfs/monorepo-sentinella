import { Inject, Injectable } from '@nestjs/common';
import { Request } from 'express';
import type { AuthenticatedUser } from 'src/guards/auth.guard';

import { IniciarInspecaoInput } from '../dtos/iniciar-inspecao.body';
import { FocoRisco } from '../entities/foco-risco';
import { FocoRiscoException } from '../errors/foco-risco.exception';
import { FocoRiscoReadRepository } from '../repositories/foco-risco-read.repository';
import { FocoRiscoWriteRepository } from '../repositories/foco-risco-write.repository';

@Injectable()
export class IniciarInspecao {
  constructor(
    private readRepository: FocoRiscoReadRepository,
    private writeRepository: FocoRiscoWriteRepository,
    @Inject('REQUEST') private req: Request,
  ) {}

  async execute(id: string, input: IniciarInspecaoInput) {
    const foco = await this.readRepository.findById(id);
    if (!foco) throw FocoRiscoException.notFound();

    this.assertFocoDoTenant(foco);

    const user = this.req['user'] as AuthenticatedUser | undefined;
    const isAdmin = user?.isPlatformAdmin ?? false;

    if (!isAdmin) {
      if (!foco.responsavelId) {
        throw FocoRiscoException.inicioInspecaoSemResponsavel();
      }
      if (user?.id !== foco.responsavelId) {
        throw FocoRiscoException.inicioInspecaoApenasResponsavel();
      }
    }

    if (foco.status !== 'aguarda_inspecao') {
      throw FocoRiscoException.statusInvalido();
    }

    const statusAnterior = foco.status;
    foco.status = 'em_inspecao';
    foco.inspecaoEm = new Date();
    if (input.observacao) foco.observacao = input.observacao;

    await this.writeRepository.save(foco);

    await this.writeRepository.createHistorico({
      focoRiscoId: foco.id,
      clienteId: foco.clienteId,
      statusAnterior: statusAnterior,
      statusNovo: 'em_inspecao',
      alteradoPor: this.req['user']?.id,
      motivo: input.observacao,
      tipoEvento: 'inicio_inspecao',
    });

    return { foco };
  }

  private assertFocoDoTenant(foco: FocoRisco) {
    const user = this.req['user'] as AuthenticatedUser | undefined;
    const tenantId = this.req['tenantId'] as string | undefined;
    if (user?.isPlatformAdmin) return;
    if (!tenantId || foco.clienteId !== tenantId) {
      throw FocoRiscoException.notFound();
    }
  }
}
