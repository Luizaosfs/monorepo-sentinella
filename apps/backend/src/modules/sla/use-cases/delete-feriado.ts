import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { assertTenantOwnership } from 'src/shared/security/tenant-ownership.util';

import { SlaException } from '../errors/sla.exception';
import { SlaReadRepository } from '../repositories/sla-read.repository';
import { SlaWriteRepository } from '../repositories/sla-write.repository';

@Injectable()
export class DeleteFeriado {
  constructor(
    private readRepository: SlaReadRepository,
    private writeRepository: SlaWriteRepository,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute(id: string) {
    const feriado = await this.readRepository.findFeriadoById(id);
    if (!feriado) throw SlaException.feriadoNotFound();
    assertTenantOwnership(feriado.clienteId, this.req);

    await this.writeRepository.deleteFeriado(id);
    return { deleted: true };
  }
}
