import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

@Injectable()
export class SeedService {
  constructor(private prisma: PrismaService) {}

  async seedRiskPolicy(clienteId: string, policy: {
    name?: string;
    version?: string;
    rules?: Array<Record<string, unknown>>;
  }): Promise<{ ok: true; policyId: string }> {
    const existing = await this.prisma.client.sentinela_risk_policy.findFirst({
      where: { cliente_id: clienteId, name: policy.name ?? 'default' },
    });

    const data = {
      cliente_id: clienteId,
      name: policy.name ?? 'default',
      version: policy.version ?? 'v1',
      is_active: true,
    };

    const record = existing
      ? await this.prisma.client.sentinela_risk_policy.update({ where: { id: existing.id }, data })
      : await this.prisma.client.sentinela_risk_policy.create({ data });

    return { ok: true, policyId: record.id };
  }

  async seedSlaConfig(clienteId: string, config: Record<string, unknown>): Promise<{ ok: true }> {
    const existing = await this.prisma.client.sla_config.findFirst({ where: { cliente_id: clienteId } });
    if (existing) {
      await this.prisma.client.sla_config.update({ where: { id: existing.id }, data: { config: config as any } });
    } else {
      await this.prisma.client.sla_config.create({ data: { cliente_id: clienteId, config: config as any } });
    }
    return { ok: true };
  }

  async seedPlanoAcaoCatalogo(
    clienteId: string,
    items: Array<{ label: string; descricao?: string; tipo_item?: string; ativo?: boolean; ordem?: number }>,
  ): Promise<{ ok: true; count: number }> {
    await this.prisma.client.plano_acao_catalogo.deleteMany({ where: { cliente_id: clienteId } });
    await this.prisma.client.plano_acao_catalogo.createMany({
      data: items.map((item) => ({
        cliente_id: clienteId,
        label: item.label,
        descricao: item.descricao,
        tipo_item: item.tipo_item,
        ativo: item.ativo ?? true,
        ordem: item.ordem ?? 0,
      })),
    });
    return { ok: true, count: items.length };
  }

  async seedSlaFeriados(
    clienteId: string,
    feriados: Array<{ data: string; descricao: string; nacional?: boolean }>,
  ): Promise<{ ok: true; count: number }> {
    await this.prisma.client.sla_feriados.deleteMany({ where: { cliente_id: clienteId } });
    await this.prisma.client.sla_feriados.createMany({
      data: feriados.map((f) => ({
        cliente_id: clienteId,
        data: new Date(f.data),
        descricao: f.descricao,
        nacional: f.nacional ?? false,
        created_at: new Date(),
      })),
    });
    return { ok: true, count: feriados.length };
  }

  async seedDroneRiskConfig(
    clienteId: string,
    config: {
      base_by_risco?: Record<string, unknown>;
      priority_thresholds?: Record<string, unknown>;
      sla_by_priority_hours?: Record<string, unknown>;
      confidence_multiplier?: number;
      item_overrides?: Record<string, unknown>;
    },
    yoloClasses: Array<{ item_key: string; item: string; risco: string; peso: number; acao?: string; is_active?: boolean }>,
    synonyms: Array<{ synonym: string; maps_to: string }>,
  ): Promise<{ ok: true }> {
    const existing = await this.prisma.client.sentinela_drone_risk_config.findFirst({ where: { cliente_id: clienteId } });

    const droneData = {
      cliente_id: clienteId,
      ...(config.base_by_risco && { base_by_risco: config.base_by_risco as any }),
      ...(config.priority_thresholds && { priority_thresholds: config.priority_thresholds as any }),
      ...(config.sla_by_priority_hours && { sla_by_priority_hours: config.sla_by_priority_hours as any }),
      ...(config.confidence_multiplier !== undefined && { confidence_multiplier: config.confidence_multiplier }),
      ...(config.item_overrides && { item_overrides: config.item_overrides as any }),
    };

    if (existing) {
      await this.prisma.client.sentinela_drone_risk_config.update({ where: { id: existing.id }, data: droneData });
    } else {
      await this.prisma.client.sentinela_drone_risk_config.create({ data: droneData });
    }

    if (yoloClasses.length) {
      await this.prisma.client.sentinela_yolo_class_config.deleteMany({ where: { cliente_id: clienteId } });
      await this.prisma.client.sentinela_yolo_class_config.createMany({
        data: yoloClasses.map((c) => ({
          cliente_id: clienteId,
          item_key: c.item_key,
          item: c.item,
          risco: c.risco,
          peso: c.peso,
          acao: c.acao,
          is_active: c.is_active ?? true,
        })),
      });
    }

    if (synonyms.length) {
      await this.prisma.client.sentinela_yolo_synonym.deleteMany({ where: { cliente_id: clienteId } });
      await this.prisma.client.sentinela_yolo_synonym.createMany({
        data: synonyms.map((s) => ({
          cliente_id: clienteId,
          synonym: s.synonym,
          maps_to: s.maps_to,
          created_at: new Date(),
        })),
      });
    }

    return { ok: true };
  }
}
