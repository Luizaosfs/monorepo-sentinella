import { Inject, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { getAccessScope } from '@shared/security/access-scope.helpers';
import { assertTenantOwnership } from 'src/shared/security/tenant-ownership.util';

import { CoberturaCicloInput } from '../dtos/cobertura-ciclo.input';
import { QuarteiraoException } from '../errors/quarteirao.exception';
import { QuarteiraoReadRepository } from '../repositories/quarteirao-read.repository';

@Injectable()
export class CoberturaCiclo {
  constructor(
    private repository: QuarteiraoReadRepository,
    @Inject('REQUEST') private req: Request,
  ) {}

  async execute(input: CoberturaCicloInput) {
    const isAdmin = this.req['user']?.isPlatformAdmin ?? false;
    if (
      input.clienteId &&
      !isAdmin &&
      input.clienteId !== getAccessScope(this.req).tenantId
    ) {
      throw QuarteiraoException.forbiddenTenant();
    }

    // MT-02: tenantId do guard sempre vence — nunca aceita clienteId do frontend
    const clienteId = getAccessScope(this.req).tenantId;
    if (!clienteId) {
      throw QuarteiraoException.badRequest();
    }

    assertTenantOwnership(clienteId, this.req, () =>
      QuarteiraoException.forbiddenTenant(),
    );

    return this.repository.coberturaQuarteiraoCiclo({
      clienteId,
      ciclo: input.ciclo,
    });
  }
}
