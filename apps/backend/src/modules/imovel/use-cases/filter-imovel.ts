import { Injectable } from '@nestjs/common';

import { FilterImovelInput } from '../dtos/filter-imovel.input';
import { ImovelReadRepository } from '../repositories/imovel-read.repository';

@Injectable()
export class FilterImovel {
  constructor(private repository: ImovelReadRepository) {}

  async execute(filters: FilterImovelInput) {
    const imoveis = await this.repository.findAll(filters);
    return { imoveis };
  }
}
