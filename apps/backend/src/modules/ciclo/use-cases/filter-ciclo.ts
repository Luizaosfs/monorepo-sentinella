import { Injectable } from '@nestjs/common';

import { FilterCicloInput } from '../dtos/filter-ciclo.input';
import { CicloReadRepository } from '../repositories/ciclo-read.repository';

@Injectable()
export class FilterCiclo {
  constructor(private repository: CicloReadRepository) {}

  async execute(filters: FilterCicloInput) {
    const ciclos = await this.repository.findAll(filters);
    return { ciclos };
  }
}
