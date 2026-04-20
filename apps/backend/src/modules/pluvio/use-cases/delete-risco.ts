import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { assertTenantOwnership } from 'src/shared/security/tenant-ownership.util';

import { PluvioException } from '../errors/pluvio.exception';
import { PluvioReadRepository } from '../repositories/pluvio-read.repository';
import { PluvioWriteRepository } from '../repositories/pluvio-write.repository';

@Injectable()
export class DeleteRisco {
  constructor(
    private readRepository: PluvioReadRepository,
    private writeRepository: PluvioWriteRepository,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute(id: string) {
    const risco = await this.readRepository.findRiscoById(id);
    if (!risco) throw PluvioException.notFound();

    const clienteId = await this.readRepository.findClienteIdByRegiaoId(risco.regiaoId);
    assertTenantOwnership(clienteId, this.req);

    await this.writeRepository.deleteRisco(id);
  }
}
