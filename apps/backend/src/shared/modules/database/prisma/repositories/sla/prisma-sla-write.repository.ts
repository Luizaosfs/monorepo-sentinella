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

  async save(entity: SlaOperacional): Promise<void> {
    await this.prisma.client.sla_operacional.update({
      where: { id: entity.id },
      data: PrismaSlaMapper.slaOperacionalToPrisma(entity),
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
