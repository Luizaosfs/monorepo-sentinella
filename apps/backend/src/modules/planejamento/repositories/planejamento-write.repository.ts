import { Injectable } from '@nestjs/common';

import { Planejamento } from '../entities/planejamento';

@Injectable()
export abstract class PlanejamentoWriteRepository {
  abstract create(entity: Planejamento): Promise<Planejamento>;
  abstract save(entity: Planejamento): Promise<void>;
  abstract softDelete(id: string, deletedBy: string): Promise<void>;
}
