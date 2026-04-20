import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { assertTenantOwnership } from 'src/shared/security/tenant-ownership.util';

import { RegiaoException } from '../errors/regiao.exception';
import { RegiaoReadRepository } from '../repositories/regiao-read.repository';
import { RegiaoWriteRepository } from '../repositories/regiao-write.repository';

@Injectable()
export class DeleteRegiao {
  constructor(
    private readRepository: RegiaoReadRepository,
    private writeRepository: RegiaoWriteRepository,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute(id: string) {
    const regiao = await this.readRepository.findById(id);
    if (!regiao) throw RegiaoException.notFound();
    assertTenantOwnership(regiao.clienteId, this.req);
    regiao.ativo = false;
    await this.writeRepository.save(regiao);
  }
}
