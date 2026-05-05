import { Inject, Injectable, Scope } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { getAccessScope, requireTenantId } from '@shared/security/access-scope.helpers';

import { CreateCicloBody } from '../dtos/create-ciclo.body';
import { Ciclo } from '../entities/ciclo';
import { CicloWriteRepository } from '../repositories/ciclo-write.repository';

@Injectable({ scope: Scope.REQUEST })
export class CreateCiclo {
  constructor(
    private writeRepository: CicloWriteRepository,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute(input: CreateCicloBody) {
    const ciclo = new Ciclo(
      {
        clienteId: requireTenantId(getAccessScope(this.req)),
        numero: input.numero,
        ano: input.ano,
        status: input.status ?? 'planejamento',
        dataInicio: input.dataInicio as Date,
        dataFimPrevista: input.dataFimPrevista as Date,
        observacaoAbertura: input.observacaoAbertura,
      },
      { createdBy: this.req['user']?.id },
    );

    const created = await this.writeRepository.create(ciclo);
    return { ciclo: created };
  }
}
