import {
  SlaConfig,
  SlaFeriado,
  SlaFocoConfig,
} from 'src/modules/sla/entities/sla-config';
import type { JsonObject } from '@shared/types/json';
import { Prisma } from '@prisma/client';
import { SlaOperacional } from 'src/modules/sla/entities/sla-operacional';

type RawSlaOperacional = {
  id: string;
  item_id: string | null;
  agente_id: string | null;
  prioridade: string;
  sla_horas: number;
  inicio: Date;
  prazo_final: Date;
  concluido_em: Date | null;
  status: string;
  violado: boolean;
  escalonado: boolean;
  escalonado_em: Date | null;
  prioridade_original: string | null;
  cliente_id: string | null;
  levantamento_item_id: string | null;
  escalonado_automatico: boolean;
  foco_risco_id: string | null;
  escalado_por: string | null;
  reaberto_por: string | null;
  deleted_at: Date | null;
  deleted_by: string | null;
  created_at: Date;
  updated_at: Date;
};

export class PrismaSlaMapper {
  static slaOperacionalToDomain(raw: RawSlaOperacional): SlaOperacional {
    return new SlaOperacional(
      {
        itemId: raw.item_id ?? undefined,
        agenteId: raw.agente_id ?? undefined,
        prioridade: raw.prioridade,
        slaHoras: raw.sla_horas,
        inicio: raw.inicio,
        prazoFinal: raw.prazo_final,
        concluidoEm: raw.concluido_em ?? undefined,
        status: raw.status,
        violado: raw.violado,
        escalonado: raw.escalonado,
        escalonadoEm: raw.escalonado_em ?? undefined,
        prioridadeOriginal: raw.prioridade_original ?? undefined,
        clienteId: raw.cliente_id ?? undefined,
        levantamentoItemId: raw.levantamento_item_id ?? undefined,
        escalonadoAutomatico: raw.escalonado_automatico,
        focoRiscoId: raw.foco_risco_id ?? undefined,
        escaladoPor: raw.escalado_por ?? undefined,
      },
      {
        id: raw.id,
        createdAt: raw.created_at,
        updatedAt: raw.updated_at,
        deletedAt: raw.deleted_at ?? undefined,
      },
    );
  }

  static slaOperacionalToPrisma(entity: SlaOperacional) {
    return {
      agente_id: entity.agenteId ?? null,
      prioridade: entity.prioridade,
      sla_horas: entity.slaHoras,
      prazo_final: entity.prazoFinal,
      concluido_em: entity.concluidoEm ?? null,
      status: entity.status,
      violado: entity.violado,
      escalonado: entity.escalonado,
      escalonado_em: entity.escalonadoEm ?? null,
      prioridade_original: entity.prioridadeOriginal ?? null,
      escalonado_automatico: entity.escalonadoAutomatico,
      escalado_por: entity.escaladoPor ?? null,
      updated_at: new Date(),
    };
  }

  static slaConfigToDomain(raw: {
    id: string;
    cliente_id: string;
    config: Prisma.JsonValue;
    created_at: Date;
    updated_at: Date;
  }): SlaConfig {
    return new SlaConfig(
      {
        clienteId: raw.cliente_id,
        config: raw.config as JsonObject,
      },
      { id: raw.id, createdAt: raw.created_at, updatedAt: raw.updated_at },
    );
  }

  static slaFeriadoToDomain(raw: {
    id: string;
    cliente_id: string;
    data: Date;
    descricao: string;
    nacional: boolean;
    created_at: Date;
  }): SlaFeriado {
    return new SlaFeriado(
      {
        clienteId: raw.cliente_id,
        data: raw.data,
        descricao: raw.descricao,
        nacional: raw.nacional,
      },
      { id: raw.id, createdAt: raw.created_at },
    );
  }

  static slaFocoConfigToDomain(raw: {
    id: string;
    cliente_id: string;
    fase: string;
    prazo_minutos: number;
    ativo: boolean;
    created_at: Date;
    updated_at: Date;
  }): SlaFocoConfig {
    return new SlaFocoConfig(
      {
        clienteId: raw.cliente_id,
        fase: raw.fase,
        prazoMinutos: raw.prazo_minutos,
        ativo: raw.ativo,
      },
      { id: raw.id, createdAt: raw.created_at, updatedAt: raw.updated_at },
    );
  }
}
