import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { getAccessScope, requireTenantId } from '@shared/security/access-scope.helpers';
import { FocoRiscoException } from '../errors/foco-risco.exception';
import { FocoRiscoReadRepository } from '../repositories/foco-risco-read.repository';

@Injectable()
export class GetFocoTimeline {
  constructor(
    private repository: FocoRiscoReadRepository,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute(focoId: string) {
    const tenantId = requireTenantId(getAccessScope(this.req));
    const foco = await this.repository.findById(focoId, tenantId);
    if (!foco) throw FocoRiscoException.notFound();
    return this.repository.findTimeline(focoId);
  }
}
