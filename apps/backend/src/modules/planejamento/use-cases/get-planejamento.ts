import { Injectable } from '@nestjs/common';

import { PlanejamentoException } from '../errors/planejamento.exception';
import { PlanejamentoReadRepository } from '../repositories/planejamento-read.repository';

@Injectable()
export class GetPlanejamento {
  constructor(private repository: PlanejamentoReadRepository) {}

  async execute(id: string) {
    const planejamento = await this.repository.findById(id);
    if (!planejamento) throw PlanejamentoException.notFound();
    return { planejamento };
  }
}
