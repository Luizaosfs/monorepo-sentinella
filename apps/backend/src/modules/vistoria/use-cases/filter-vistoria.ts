import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { getAccessScope, requireTenantId } from '@shared/security/access-scope.helpers';

import { FilterVistoriaInput } from '../dtos/filter-vistoria.input';
import { VistoriaReadRepository } from '../repositories/vistoria-read.repository';

@Injectable()
export class FilterVistoria {
  constructor(
    private repository: VistoriaReadRepository,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute(filters: FilterVistoriaInput) {
    // MT-02: tenantId do guard sempre vence — nunca aceita clienteId do frontend
    const clienteId = requireTenantId(getAccessScope(this.req));
    const vistorias = await this.repository.findAll({ ...filters, clienteId });
    return { vistorias };
  }
}
