import { Injectable } from '@nestjs/common';

import { FocoRiscoReadRepository } from '../repositories/foco-risco-read.repository';
import { FocoRiscoWriteRepository } from '../repositories/foco-risco-write.repository';
import { calcularScorePrioridadeFoco } from './score/calcular-score-prioridade-foco';

@Injectable()
export class RecalcularScorePrioridadeFoco {
  constructor(
    private readRepository: FocoRiscoReadRepository,
    private writeRepository: FocoRiscoWriteRepository,
  ) {}

  async execute(focoId: string): Promise<{ score: number }> {
    const inputs = await this.readRepository.findInputsParaScorePrioridade(focoId);
    if (!inputs) return { score: 0 };

    const score = calcularScorePrioridadeFoco(inputs);
    await this.writeRepository.updateScorePrioridade(focoId, score);
    return { score };
  }
}
