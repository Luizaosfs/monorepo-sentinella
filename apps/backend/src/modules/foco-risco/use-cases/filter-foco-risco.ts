import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { AuthenticatedUser } from 'src/guards/auth.guard';

import { FilterFocoRiscoInput } from '../dtos/filter-foco-risco.input';
import { FocoRiscoReadRepository } from '../repositories/foco-risco-read.repository';

@Injectable()
export class FilterFocoRisco {
  constructor(
    private repository: FocoRiscoReadRepository,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute(filters: FilterFocoRiscoInput) {
    const user = this.req['user'] as AuthenticatedUser;
    const isPrivileged = user.isPlatformAdmin || user.papeis.includes('supervisor');

    const effectiveFilters: FilterFocoRiscoInput = isPrivileged
      ? filters
      : { ...filters, responsavelId: user.id };

    const focos = await this.repository.findAll(effectiveFilters);
    return { focos };
  }
}
