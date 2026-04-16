import { Injectable } from '@nestjs/common';

import { PluvioItem, PluvioRisco, PluvioRun } from '../entities/pluvio';

export interface SlaInput {
  clienteId: string;
  itemId: string;
  prioridade: string;
  slaHoras: number;
}

@Injectable()
export abstract class PluvioWriteRepository {
  abstract createRun(run: PluvioRun): Promise<PluvioRun>;
  abstract saveRun(run: PluvioRun): Promise<void>;
  abstract deleteRun(id: string): Promise<void>;
  abstract upsertItem(item: PluvioItem): Promise<PluvioItem>;
  abstract bulkInsertItems(items: PluvioItem[]): Promise<void>;
  abstract deleteItem(id: string): Promise<void>;
  abstract upsertRisco(risco: PluvioRisco): Promise<PluvioRisco>;
  abstract bulkInsertRisco(riscos: PluvioRisco[]): Promise<void>;
  abstract deleteRisco(id: string): Promise<void>;
  abstract createSlasBulk(slas: SlaInput[]): Promise<number>;
}
