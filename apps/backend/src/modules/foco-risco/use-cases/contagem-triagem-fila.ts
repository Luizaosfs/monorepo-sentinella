import { Injectable } from '@nestjs/common';

import { FilterFocoRiscoInput } from '../dtos/filter-foco-risco.input';
import { ContagemTriagemResult, FocoRiscoReadRepository } from '../repositories/foco-risco-read.repository';

@Injectable()
export class ContagemTriagemFila {
  constructor(private repository: FocoRiscoReadRepository) {}

  async execute(filters: FilterFocoRiscoInput): Promise<ContagemTriagemResult> {
    return this.repository.findContagemTriagem(filters);
  }
}
