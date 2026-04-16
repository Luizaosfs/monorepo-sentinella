import { Injectable } from '@nestjs/common';

import { ImovelException } from '../errors/imovel.exception';
import { ImovelReadRepository } from '../repositories/imovel-read.repository';

@Injectable()
export class GetImovel {
  constructor(private repository: ImovelReadRepository) {}

  async execute(id: string) {
    const imovel = await this.repository.findById(id);
    if (!imovel) throw ImovelException.notFound();
    return { imovel };
  }
}
