import {
  SlaConfig,
  SlaFeriado,
  SlaFocoConfig,
} from '@modules/sla/entities/sla-config';
import { SlaOperacional } from '@modules/sla/entities/sla-operacional';
import { SlaWriteRepository } from '@modules/sla/repositories/sla-write.repository';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { JsonObject } from '@shared/types/json';

import { PrismaRepository } from '@/decorators/prisma-repository.decorator';

import { PrismaSlaMapper } from '../../mappers/prisma-sla.mapper';
import { PrismaService } from '../../prisma.service';

@PrismaRepository(SlaWriteRepository)
@Injectable()
export class PrismaSlaWriteRepository implements SlaWriteRepository {
  constructor(private prisma: PrismaService) {}

  /**
   * Se `tx` veio de dentro de um `$transaction(callback)`, usa o tx-client;
   * caso contrário cai no cliente estendido padrão. Permite que o mesmo
   * repo seja chamado dentro e fora de transações sem duplicar métodos.
   */
  private resolveClient(tx?: unknown) {
    return (tx ?? this.prisma.client) as any;
  }

  async save(entity: SlaOperacional): Promise<void> {
    await this.prisma.client.sla_operacional.update({
      where: { id: entity.id },
      data: PrismaSlaMapper.slaOperacionalToPrisma(entity),
    });
  }

  async createFromFoco(
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
  ): Promise<{ id: string; conflicted: boolean }> {
    const client = this.resolveClient(tx);
    try {
      const row = await client.sla_operacional.create({
        data: {
          cliente_id: data.clienteId,
          foco_risco_id: data.focoRiscoId,
          levantamento_item_id: data.levantamentoItemId,
          prioridade: data.prioridade,
          sla_horas: data.slaHoras,
          inicio: data.inicio,
          prazo_final: data.prazoFinal,
          status: 'pendente',
          violado: false,
          escalonado: false,
          escalonado_automatico: false,
        },
      });
      return { id: row.id, conflicted: false };
    } catch (err: unknown) {
      // P2002 = unique constraint — equivalente a ON CONFLICT DO NOTHING.
      // Outro foco já tinha SLA criado em paralelo: não é erro, idempotência.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        return { id: '', conflicted: true };
      }
      throw err;
    }
  }

  async vincularAFoco(
    focoRiscoId: string,
    levantamentoItemId: string,
    tx?: unknown,
  ): Promise<number> {
    const client = this.resolveClient(tx);
    const result = await client.sla_operacional.updateMany({
      where: {
        levantamento_item_id: levantamentoItemId,
        foco_risco_id: null,
        deleted_at: null,
      },
      data: { foco_risco_id: focoRiscoId },
    });
    return result.count;
  }

  async fecharTodosPorFoco(
    focoRiscoId: string,
    tx?: unknown,
  ): Promise<number> {
    const client = this.resolveClient(tx);
    const result = await client.sla_operacional.updateMany({
      where: {
        foco_risco_id: focoRiscoId,
        status: { in: ['pendente', 'em_atendimento'] },
        deleted_at: null,
      },
      data: {
        status: 'concluido',
        concluido_em: new Date(),
      },
    });
    return result.count;
  }

  async registrarErroCriacao(data: {
    clienteId: string | null;
    focoRiscoId: string | null;
    erro: string;
    contexto: JsonObject;
  }): Promise<void> {
    // Compensação: roda SEMPRE fora da transação que falhou, caso contrário
    // o rollback do outer tx apagaria o log. Usa `this.prisma.client` direto.
    await this.prisma.client.sla_erros_criacao.create({
      data: {
        cliente_id: data.clienteId,
        item_id: data.focoRiscoId,
        erro: data.erro,
        contexto: data.contexto as Prisma.InputJsonValue,
      },
    });
  }

  async upsertConfig(
    clienteId: string,
    config: JsonObject,
  ): Promise<SlaConfig> {
    const existing = await this.prisma.client.sla_config.findFirst({
      where: { cliente_id: clienteId },
    });
    let raw: any;
    if (existing) {
      raw = await this.prisma.client.sla_config.update({
        where: { id: existing.id },
        data: {
          config: config as Prisma.InputJsonValue,
          updated_at: new Date(),
        },
      });
    } else {
      raw = await this.prisma.client.sla_config.create({
        data: {
          cliente_id: clienteId,
          config: config as Prisma.InputJsonValue,
        },
      });
    }
    return PrismaSlaMapper.slaConfigToDomain(raw as any);
  }

  async createConfigAudit(data: {
    clienteId: string;
    changedBy?: string;
    action: string;
    configBefore?: JsonObject;
    configAfter?: JsonObject;
  }): Promise<void> {
    await this.prisma.client.sla_config_audit.create({
      data: {
        cliente_id: data.clienteId,
        changed_by: data.changedBy ?? null,
        action: data.action,
        config_before:
          data.configBefore == null
            ? Prisma.JsonNull
            : (data.configBefore as Prisma.InputJsonValue),
        config_after:
          data.configAfter == null
            ? Prisma.JsonNull
            : (data.configAfter as Prisma.InputJsonValue),
      },
    });
  }

  async upsertConfigRegiao(
    clienteId: string,
    regiaoId: string,
    config: JsonObject,
  ): Promise<void> {
    const existing = await this.prisma.client.sla_config_regiao.findFirst({
      where: { cliente_id: clienteId, regiao_id: regiaoId },
    });
    const now = new Date();
    if (existing) {
      await this.prisma.client.sla_config_regiao.update({
        where: { id: existing.id },
        data: {
          config: config as Prisma.InputJsonValue,
          updated_at: now,
        },
      });
    } else {
      await this.prisma.client.sla_config_regiao.create({
        data: {
          cliente_id: clienteId,
          regiao_id: regiaoId,
          config: config as Prisma.InputJsonValue,
          created_at: now,
          updated_at: now,
        },
      });
    }
  }

  async createFeriado(data: {
    clienteId: string;
    data: Date;
    descricao: string;
    nacional: boolean;
  }): Promise<SlaFeriado> {
    const raw = await this.prisma.client.sla_feriados.create({
      data: {
        cliente_id: data.clienteId,
        data: data.data,
        descricao: data.descricao,
        nacional: data.nacional,
        created_at: new Date(),
      },
    });
    return PrismaSlaMapper.slaFeriadoToDomain(raw as any);
  }

  async deleteFeriado(id: string): Promise<void> {
    await this.prisma.client.sla_feriados.delete({
      where: { id },
    });
  }

  async marcarEscalonadoAutomatico(slaIds: string[]): Promise<number> {
    if (slaIds.length === 0) return 0;
    const { count } = await this.prisma.client.sla_operacional.updateMany({
      where: { id: { in: slaIds } },
      data: { escalonado_automatico: true },
    });
    return count;
  }

  async upsertFocoConfig(
    clienteId: string,
    configs: Array<{ fase: string; prazoMinutos: number; ativo: boolean }>,
  ): Promise<SlaFocoConfig[]> {
    const now = new Date();
    const results: SlaFocoConfig[] = [];
    for (const cfg of configs) {
      const existing = await this.prisma.client.sla_foco_config.findFirst({
        where: { cliente_id: clienteId, fase: cfg.fase },
      });
      let raw: any;
      if (existing) {
        raw = await this.prisma.client.sla_foco_config.update({
          where: { id: existing.id },
          data: {
            prazo_minutos: cfg.prazoMinutos,
            ativo: cfg.ativo,
            updated_at: now,
          },
        });
      } else {
        raw = await this.prisma.client.sla_foco_config.create({
          data: {
            cliente_id: clienteId,
            fase: cfg.fase,
            prazo_minutos: cfg.prazoMinutos,
            ativo: cfg.ativo,
            created_at: now,
            updated_at: now,
          },
        });
      }
      results.push(PrismaSlaMapper.slaFocoConfigToDomain(raw as any));
    }
    return results;
  }
}
