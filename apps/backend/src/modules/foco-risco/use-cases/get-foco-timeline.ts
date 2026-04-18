import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { AuthenticatedUser } from 'src/guards/auth.guard';

import { FocoRiscoException } from '../errors/foco-risco.exception';
import { FocoRiscoReadRepository } from '../repositories/foco-risco-read.repository';

@Injectable()
export class GetFocoTimeline {
  constructor(
    private repository: FocoRiscoReadRepository,
    @Inject(REQUEST) private req: Request,
  ) {}

  private assertTenant(clienteId: string | undefined): void {
    const user = this.req['user'] as AuthenticatedUser | undefined;
    if (user?.isPlatformAdmin) return;
    const tenantId = this.req['tenantId'] as string | undefined;
    if (!tenantId || clienteId !== tenantId) {
      throw new ForbiddenException('Acesso negado: recurso pertence a outro tenant');
    }
  }

  async execute(focoId: string) {
    const foco = await this.repository.findById(focoId);
    if (!foco) throw FocoRiscoException.notFound();
    this.assertTenant(foco.clienteId);
    return this.repository.findTimeline(focoId);
  }
}
