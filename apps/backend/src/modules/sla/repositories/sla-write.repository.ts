import { Injectable } from '@nestjs/common';
import type { JsonObject } from '@shared/types/json';

import { SlaConfig, SlaFeriado, SlaFocoConfig } from '../entities/sla-config';
import { SlaOperacional } from '../entities/sla-operacional';

@Injectable()
export abstract class SlaWriteRepository {
  abstract save(entity: SlaOperacional): Promise<void>;
  abstract upsertConfig(
    clienteId: string,
    config: JsonObject,
  ): Promise<SlaConfig>;
  abstract createConfigAudit(data: {
    clienteId: string;
    changedBy?: string;
    action: string;
    configBefore?: JsonObject;
    configAfter?: JsonObject;
  }): Promise<void>;
  abstract upsertConfigRegiao(
    clienteId: string,
    regiaoId: string,
    config: JsonObject,
  ): Promise<void>;
  abstract createFeriado(data: {
    clienteId: string;
    data: Date;
    descricao: string;
    nacional: boolean;
  }): Promise<SlaFeriado>;
  abstract deleteFeriado(id: string): Promise<void>;
  abstract upsertFocoConfig(
    clienteId: string,
    configs: Array<{ fase: string; prazoMinutos: number; ativo: boolean }>,
  ): Promise<SlaFocoConfig[]>;
}
