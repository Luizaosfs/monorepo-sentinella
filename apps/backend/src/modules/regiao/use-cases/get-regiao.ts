import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { assertTenantOwnership } from 'src/shared/security/tenant-ownership.util';

import { RegiaoException } from '../errors/regiao.exception';
import { RegiaoReadRepository } from '../repositories/regiao-read.repository';

@Injectable()
export class GetRegiao {
  constructor(
    private repository: RegiaoReadRepository,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute(id: string) {
    const regiao = await this.repository.findById(id);
    if (!regiao) throw RegiaoException.notFound();
    assertTenantOwnership(regiao.clienteId, this.req);
    return { regiao };
  }
}
