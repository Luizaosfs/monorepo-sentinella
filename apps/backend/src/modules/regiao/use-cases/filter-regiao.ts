import { Injectable } from '@nestjs/common';

import { FilterRegiaoInput } from '../dtos/filter-regiao.input';
import { RegiaoReadRepository } from '../repositories/regiao-read.repository';

@Injectable()
export class FilterRegiao {
  constructor(private repository: RegiaoReadRepository) {}

  async execute(filters: FilterRegiaoInput) {
    const regioes = await this.repository.findAll(filters);
    return { regioes };
  }
}
