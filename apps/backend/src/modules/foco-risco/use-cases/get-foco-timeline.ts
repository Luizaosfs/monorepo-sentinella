import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { assertTenantOwnership } from 'src/shared/security/tenant-ownership.util';

import { FocoRiscoException } from '../errors/foco-risco.exception';
import { FocoRiscoReadRepository } from '../repositories/foco-risco-read.repository';

@Injectable()
export class GetFocoTimeline {
  constructor(
    private repository: FocoRiscoReadRepository,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute(focoId: string) {
    const foco = await this.repository.findById(focoId);
    if (!foco) throw FocoRiscoException.notFound();
    assertTenantOwnership(foco.clienteId, this.req);
    return this.repository.findTimeline(focoId);
  }
}
