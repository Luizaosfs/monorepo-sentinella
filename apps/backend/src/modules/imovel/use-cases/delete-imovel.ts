import { Inject, Injectable } from '@nestjs/common';
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

    await this.writeRepository.softDelete(id, this.req['user']?.id);
    return { imovel };
  }
}
