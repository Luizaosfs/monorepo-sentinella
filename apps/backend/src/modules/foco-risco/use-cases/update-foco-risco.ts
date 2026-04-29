import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { getAccessScope, requireTenantId } from '@shared/security/access-scope.helpers';

import { FocoRiscoException } from '../errors/foco-risco.exception';
import { FocoRiscoReadRepository } from '../repositories/foco-risco-read.repository';
import { FocoRiscoWriteRepository } from '../repositories/foco-risco-write.repository';

export interface UpdateFocoRiscoInput {
  responsavel_id?: string;
  desfecho?: string;
  imovel_id?: string;
}

@Injectable()
export class UpdateFocoRisco {
  constructor(
    private readRepository: FocoRiscoReadRepository,
    private writeRepository: FocoRiscoWriteRepository,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute(id: string, input: UpdateFocoRiscoInput): Promise<void> {
    const tenantId = requireTenantId(getAccessScope(this.req));
    const foco = await this.readRepository.findById(id, tenantId);
    if (!foco) throw FocoRiscoException.notFound();

    if (input.responsavel_id !== undefined && input.responsavel_id !== foco.responsavelId) {
      const user = this.req['user'];
      const isSupervisorOuAdmin = user?.isPlatformAdmin || (user?.papeis ?? []).includes('supervisor');
      if (!isSupervisorOuAdmin) {
        throw new ForbiddenException('Apenas supervisor ou admin pode alterar o responsável do foco');
      }
      foco.responsavelId = input.responsavel_id;
    } else if (input.responsavel_id !== undefined) {
      foco.responsavelId = input.responsavel_id;
    }
    if (input.desfecho !== undefined) foco.desfecho = input.desfecho;
    if (input.imovel_id !== undefined) foco.imovelId = input.imovel_id;

    await this.writeRepository.save(foco);
  }
}
