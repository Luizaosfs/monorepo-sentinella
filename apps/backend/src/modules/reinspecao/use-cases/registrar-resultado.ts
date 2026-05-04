import { FocoRiscoReadRepository } from '@modules/foco-risco/repositories/foco-risco-read.repository';
import { FocoRiscoWriteRepository } from '@modules/foco-risco/repositories/foco-risco-write.repository';
import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { getAccessScope } from '@shared/security/access-scope.helpers';
import { AuthenticatedUser } from 'src/guards/auth.guard';
import { ResultadoReinspecaoBody } from '../dtos/resultado-reinspecao.body';
import { ReinspecaoException } from '../errors/reinspecao.exception';
import { ReinspecaoReadRepository } from '../repositories/reinspecao-read.repository';
import { ReinspecaoWriteRepository } from '../repositories/reinspecao-write.repository';

@Injectable()
export class RegistrarResultadoReinspecao {
  constructor(
    private readRepository: ReinspecaoReadRepository,
    private writeRepository: ReinspecaoWriteRepository,
    private focoReadRepository: FocoRiscoReadRepository,
    private focoWriteRepository: FocoRiscoWriteRepository,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute(id: string, input: ResultadoReinspecaoBody) {
    const tenantId = getAccessScope(this.req).tenantId;
    const r = await this.readRepository.findById(id, tenantId);
    if (!r) {
      throw ReinspecaoException.notFound();
    }

    const user = this.req['user'] as AuthenticatedUser;
    const isPrivileged = user.isPlatformAdmin || user.papeis.includes('supervisor');
    if (!isPrivileged && r.responsavelId && r.responsavelId !== user.id) {
      throw ReinspecaoException.forbiddenTenant();
    }

    if (r.status !== 'pendente') {
      throw ReinspecaoException.badRequest();
    }

    r.status = 'realizada';
    r.resultado = input.resultado;
    r.dataRealizada = input.dataRealizada ?? new Date();

    await this.writeRepository.save(r);
    r.updatedAt = new Date();

    const foco = await this.focoReadRepository.findById(r.focoRiscoId, r.clienteId);
    if (!foco) {
      throw ReinspecaoException.focoNaoEncontrado();
    }

    await this.focoWriteRepository.createHistorico({
      focoRiscoId: foco.id,
      clienteId: foco.clienteId,
      statusAnterior: foco.status,
      statusNovo: foco.status,
      tipoEvento: 'reinspecao_realizada',
      alteradoPor: this.req['user']?.id,
      motivo: [
        `Reinspeção ${r.id} concluída.`,
        `Resultado: ${input.resultado}`,
        r.dataRealizada
          ? `Data: ${r.dataRealizada.toISOString()}`
          : undefined,
      ]
        .filter(Boolean)
        .join(' '),
    });

    return { reinspecao: r };
  }
}
