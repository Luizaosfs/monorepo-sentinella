import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { getAccessScope, requireTenantId } from '@shared/security/access-scope.helpers';

import { CicloException } from '../errors/ciclo.exception';
import { CicloReadRepository } from '../repositories/ciclo-read.repository';
import { CicloWriteRepository } from '../repositories/ciclo-write.repository';

@Injectable()
export class AtivarCiclo {
  constructor(
    private readRepository: CicloReadRepository,
    private writeRepository: CicloWriteRepository,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute(id: string) {
    const tenantId = requireTenantId(getAccessScope(this.req));
    const ciclo = await this.readRepository.findById(id, tenantId);
    if (!ciclo) throw CicloException.notFound();

    // Desativa todos os ciclos do cliente antes de ativar o novo
    await this.writeRepository.desativarTodos(tenantId);

    ciclo.status = 'ativo';
    await this.writeRepository.save(ciclo);

    return { ciclo };
  }
}
