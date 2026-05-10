import { Inject, Injectable, Scope } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { getAccessScope } from '@shared/security/access-scope.helpers';
import { assertTenantOwnership } from 'src/shared/security/tenant-ownership.util';

import { CopiarDistribuicaoBody } from '../dtos/create-distribuicao.body';
import { QuarteiraoException } from '../errors/quarteirao.exception';
import { QuarteiraoWriteRepository } from '../repositories/quarteirao-write.repository';

@Injectable({ scope: Scope.REQUEST })
export class CopiarDistribuicao {
  constructor(
    private repository: QuarteiraoWriteRepository,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute(input: CopiarDistribuicaoBody) {
    // MT-02: tenantId do guard sempre vence — nunca aceita clienteId do frontend
    const clienteId = getAccessScope(this.req).tenantId;
    if (!clienteId) {
      throw QuarteiraoException.badRequest();
    }

    assertTenantOwnership(clienteId, this.req, () =>
      QuarteiraoException.forbiddenTenant(),
    );

    if (input.cicloOrigemId === input.cicloDestinoId) {
      throw QuarteiraoException.badRequest();
    }

    const result = await this.repository.copiarDistribuicoesCiclo({
      clienteId,
      cicloOrigemId:  input.cicloOrigemId,
      cicloDestinoId: input.cicloDestinoId,
    });

    return result;
  }
}
