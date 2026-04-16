import { Injectable } from '@nestjs/common';

import { FilterFocoRiscoInput } from '../dtos/filter-foco-risco.input';
import { FocoRiscoReadRepository } from '../repositories/foco-risco-read.repository';

@Injectable()
export class FilterFocoRisco {
  constructor(private repository: FocoRiscoReadRepository) {}

  async execute(filters: FilterFocoRiscoInput) {
    const focos = await this.repository.findAll(filters);
    return { focos };
  }
}
