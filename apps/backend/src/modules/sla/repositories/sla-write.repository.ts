import { Injectable } from '@nestjs/common';
import type { JsonObject } from '@shared/types/json';

import { SlaConfig, SlaFeriado, SlaFocoConfig } from '../entities/sla-config';
import { SlaOperacional } from '../entities/sla-operacional';

@Injectable()
export abstract class SlaWriteRepository {
  abstract save(entity: SlaOperacional): Promise<void>;
  abstract createFromFoco(
    data: {
      clienteId: string;
      focoRiscoId: string;
      levantamentoItemId: string | null;
      prioridade: string;
      slaHoras: number;
      inicio: Date;
      prazoFinal: Date;
    },
    tx?: unknown,
  ): Promise<{ id: string; conflicted: boolean }>;
  abstract vincularAFoco(
    focoRiscoId: string,
    levantamentoItemId: string,
    tx?: unknown,
  ): Promise<number>;
  abstract fecharTodosPorFoco(
    focoRiscoId: string,
    tx?: unknown,
  ): Promise<number>;
  abstract registrarErroCriacao(data: {
    clienteId: string | null;
    focoRiscoId: string | null;
    erro: string;
    contexto: JsonObject;
  }): Promise<void>;
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
  abstract marcarEscalonadoAutomatico(slaIds: string[]): Promise<number>;
}
