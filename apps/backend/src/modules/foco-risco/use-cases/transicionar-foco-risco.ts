import { Inject, Injectable } from '@nestjs/common';
import { Request } from 'express';
import type { AuthenticatedUser } from 'src/guards/auth.guard';

import { TransicionarFocoRiscoBody } from '../dtos/transicionar-foco-risco.body';
import { FocoRisco, FocoRiscoStatus } from '../entities/foco-risco';
import { FocoRiscoException } from '../errors/foco-risco.exception';
import { FocoRiscoReadRepository } from '../repositories/foco-risco-read.repository';
import { FocoRiscoWriteRepository } from '../repositories/foco-risco-write.repository';

@Injectable()
export class TransicionarFocoRisco {
  constructor(
    private readRepository: FocoRiscoReadRepository,
    private writeRepository: FocoRiscoWriteRepository,
    @Inject('REQUEST') private req: Request,
  ) {}

  async execute(id: string, input: TransicionarFocoRiscoBody) {
    const foco = await this.readRepository.findById(id);
    if (!foco) throw FocoRiscoException.notFound();

    this.assertFocoDoTenant(foco);

    const novoStatus = input.statusPara as FocoRiscoStatus;

    if (!foco.podeTransicionar(novoStatus)) {
      throw FocoRiscoException.transicaoInvalida();
    }

    const statusAnterior = foco.status;
    foco.status = novoStatus;

    // Atualiza timestamps específicos por estado
    if (novoStatus === 'confirmado') foco.confirmadoEm = new Date();
    if (novoStatus === 'resolvido' || novoStatus === 'descartado') {
      foco.resolvidoEm = new Date();
      if (input.desfecho) foco.desfecho = input.desfecho;
    }

    await this.writeRepository.save(foco);

    // REGRA ABSOLUTA: toda transição deve gerar registro no histórico
    await this.writeRepository.createHistorico({
      focoRiscoId: foco.id,
      clienteId: foco.clienteId,
      statusAnterior: statusAnterior,
      statusNovo: novoStatus,
      alteradoPor: this.req['user']?.id,
      motivo: input.motivo,
      tipoEvento: 'mudanca_status',
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
