import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { Request } from 'express';

import { ImovelException } from '../errors/imovel.exception';
import { ImovelReadRepository } from '../repositories/imovel-read.repository';
import { ImovelWriteRepository } from '../repositories/imovel-write.repository';

@Injectable()
export class DeleteImovel {
  constructor(
    private readRepository: ImovelReadRepository,
    private writeRepository: ImovelWriteRepository,
    @Inject('REQUEST') private req: Request,
  ) {}

  async execute(id: string) {
    const imovel = await this.readRepository.findById(id);
    if (!imovel) throw ImovelException.notFound();

    const user = this.req['user'] as any;
    const tenantId = this.req['tenantId'] as string | undefined;
    if (!user?.isPlatformAdmin && imovel.clienteId !== tenantId) {
      throw new ForbiddenException('Acesso negado: recurso pertence a outro tenant');
    }

    await this.writeRepository.softDelete(id, this.req['user']?.id, imovel.clienteId);
    return { imovel };
  }
}
