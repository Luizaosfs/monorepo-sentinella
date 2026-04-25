import { Injectable } from '@nestjs/common';

import type { FilterPluvioRunInputType } from '../dtos/filter-pluvio-run.input';
import { PluvioItem, PluvioRisco, PluvioRun } from '../entities/pluvio';

export interface PluvioCondicaoVoo {
  regiaoId: string;
  chuva24h: number;
  ventoKmh: number;
  tempC: number;
  classificacaoFinal: string | null;
  prevD1Mm: number | null;
}

@Injectable()
export abstract class PluvioReadRepository {
  abstract findRunById(id: string): Promise<PluvioRun | null>;
  abstract findRuns(filters: FilterPluvioRunInputType): Promise<PluvioRun[]>;
  abstract findLatestRun(clienteId: string): Promise<PluvioRun | null>;
  abstract findItemById(id: string): Promise<PluvioItem | null>;
  abstract findItemsByRunId(runId: string): Promise<PluvioItem[]>;
  abstract findRiscoById(id: string): Promise<PluvioRisco | null>;
  abstract findRiscoByRegiaoIds(regiaoIds: string[]): Promise<unknown[]>;
  abstract findRiscoByClienteEData(clienteId: string, data: Date): Promise<PluvioCondicaoVoo[]>;
  abstract findClienteIdByRegiaoId(regiaoId: string): Promise<string | null>;
}
