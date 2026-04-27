import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { FocoRiscoException } from '../errors/foco-risco.exception';
import { FocoRiscoReadRepository } from '../repositories/foco-risco-read.repository';

@Injectable()
export class GetFocoTimeline {
  constructor(
    private repository: FocoRiscoReadRepository,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute(focoId: string) {
    const tenantId = (this.req['tenantId'] as string | undefined) ?? null;
    const foco = await this.repository.findById(focoId, tenantId);
    if (!foco) throw FocoRiscoException.notFound();
    return this.repository.findTimeline(focoId);
  }
}
