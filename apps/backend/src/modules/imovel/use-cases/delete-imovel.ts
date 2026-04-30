import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { getAccessScope } from '@shared/security/access-scope.helpers';

import { ImovelException } from '../errors/imovel.exception';
import { ImovelReadRepository } from '../repositories/imovel-read.repository';
import { ImovelWriteRepository } from '../repositories/imovel-write.repository';

@Injectable()
export class DeleteImovel {
  constructor(
    private readRepository: ImovelReadRepository,
    private writeRepository: ImovelWriteRepository,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute(id: string) {
    const tenantId = getAccessScope(this.req).tenantId;
    const imovel = await this.readRepository.findById(id, tenantId);
    if (!imovel) throw ImovelException.notFound();

    await this.writeRepository.softDelete(id, this.req['user']?.id, imovel.clienteId);
    return { imovel };
  }
}
