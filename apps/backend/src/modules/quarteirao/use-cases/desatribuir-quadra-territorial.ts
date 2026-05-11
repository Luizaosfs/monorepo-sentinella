import { Inject, Injectable, Scope } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { getAccessScope } from '@shared/security/access-scope.helpers';

import { QuarteiraoException } from '../errors/quarteirao.exception';
import { QuarteiraoWriteRepository } from '../repositories/quarteirao-write.repository';

@Injectable({ scope: Scope.REQUEST })
export class DesatribuirQuadraTerritorial {
  constructor(
    private repository: QuarteiraoWriteRepository,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute(quadraId: string) {
    const clienteId = getAccessScope(this.req).tenantId;
    if (!clienteId) throw QuarteiraoException.badRequest();

    const { removida } = await this.repository.desatribuirQuadraTerritorial({
      clienteId,
      quadraId,
    });

    if (!removida) throw QuarteiraoException.distribuicaoTerritorialNotFound();

    return { ok: true };
  }
}
