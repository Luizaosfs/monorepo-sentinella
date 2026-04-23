import { Injectable } from '@nestjs/common';

import { FocoRisco, FocoRiscoHistorico } from '../entities/foco-risco';

@Injectable()
export abstract class FocoRiscoWriteRepository {
  abstract create(foco: FocoRisco): Promise<FocoRisco>;
  abstract save(foco: FocoRisco, tx?: unknown): Promise<void>;
  abstract createHistorico(
    historico: FocoRiscoHistorico,
    tx?: unknown,
  ): Promise<FocoRiscoHistorico>;
  abstract updateScorePrioridade(focoId: string, score: number): Promise<void>;
}
