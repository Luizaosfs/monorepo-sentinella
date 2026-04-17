import { FilterRiskPolicyInputType } from '@modules/risk-engine/dtos/filter-risk-policy.input';
import {
  DroneRiskConfig,
  RiskPolicy,
  RiskPolicyFull,
  YoloClassConfig,
  YoloSynonym,
} from '@modules/risk-engine/entities/risk-engine';
import { RiskEngineReadRepository } from '@modules/risk-engine/repositories/risk-engine-read.repository';
import { Injectable } from '@nestjs/common';

import { PrismaRepository } from '@/decorators/prisma-repository.decorator';

import {
  PrismaDroneRiskConfigMapper,
  PrismaRiskChildMapper,
  PrismaRiskPolicyMapper,
  PrismaYoloClassConfigMapper,
  PrismaYoloSynonymMapper,
} from '../../mappers/prisma-risk-engine.mapper';
import { PrismaService } from '../../prisma.service';

@PrismaRepository(RiskEngineReadRepository)
@Injectable()
export class PrismaRiskEngineReadRepository implements RiskEngineReadRepository {
  constructor(private prisma: PrismaService) {}

  async findPolicyById(id: string): Promise<RiskPolicy | null> {
    const raw = await this.prisma.client.sentinela_risk_policy.findUnique({ where: { id } });
    return raw ? PrismaRiskPolicyMapper.toDomain(raw as any) : null;
  }

  async findPolicies(filters: FilterRiskPolicyInputType): Promise<RiskPolicy[]> {
    const rows = await this.prisma.client.sentinela_risk_policy.findMany({
      where: {
        ...(filters.clienteId != null && { cliente_id: filters.clienteId }),
        ...(filters.name && { name: { contains: filters.name, mode: 'insensitive' as const } }),
        ...(filters.version && { version: filters.version }),
        ...(filters.isActive !== undefined && { is_active: filters.isActive }),
      },
      orderBy: [{ name: 'asc' }, { version: 'asc' }],
    });
    return rows.map((r) => PrismaRiskPolicyMapper.toDomain(r as any));
  }

  async getPolicyFull(policyId: string): Promise<RiskPolicyFull | null> {
    const raw = await this.prisma.client.sentinela_risk_policy.findUnique({ where: { id: policyId } });
    if (!raw) return null;

    const [
      defaults, fallbackRule, rules,
      binsSemChuva, binsIntensidadeChuva, binsPersistencia7d,
      tempFactors, ventoFactors,
      tempAdjustPp, ventoAdjustPp, persistenciaAdjustPp, tendenciaAdjustPp,
    ] = await Promise.all([
      this.prisma.client.sentinela_risk_defaults.findFirst({ where: { policy_id: policyId } }),
      this.prisma.client.sentinela_risk_fallback_rule.findFirst({ where: { policy_id: policyId } }),
      this.prisma.client.sentinela_risk_rule.findMany({ where: { policy_id: policyId }, orderBy: { idx: 'asc' } }),
      this.prisma.client.sentinela_risk_bin_sem_chuva.findMany({ where: { policy_id: policyId }, orderBy: { idx: 'asc' } }),
      this.prisma.client.sentinela_risk_bin_intensidade_chuva.findMany({ where: { policy_id: policyId }, orderBy: { idx: 'asc' } }),
      this.prisma.client.sentinela_risk_bin_persistencia_7d.findMany({ where: { policy_id: policyId }, orderBy: { idx: 'asc' } }),
      this.prisma.client.sentinela_risk_temp_factor.findMany({ where: { policy_id: policyId }, orderBy: { idx: 'asc' } }),
      this.prisma.client.sentinela_risk_vento_factor.findMany({ where: { policy_id: policyId }, orderBy: { idx: 'asc' } }),
      this.prisma.client.sentinela_risk_temp_adjust_pp.findMany({ where: { policy_id: policyId }, orderBy: { idx: 'asc' } }),
      this.prisma.client.sentinela_risk_vento_adjust_pp.findMany({ where: { policy_id: policyId }, orderBy: { idx: 'asc' } }),
      this.prisma.client.sentinela_risk_persistencia_adjust_pp.findMany({ where: { policy_id: policyId }, orderBy: { idx: 'asc' } }),
      this.prisma.client.sentinela_risk_tendencia_adjust_pp.findMany({ where: { policy_id: policyId } }),
    ]);

    return {
      policy: PrismaRiskPolicyMapper.toDomain(raw as any),
      defaults: defaults ? PrismaRiskChildMapper.defaultsToDomain(defaults as any) : null,
      fallbackRule: fallbackRule ? PrismaRiskChildMapper.fallbackToDomain(fallbackRule as any) : null,
      rules: rules.map((r) => PrismaRiskChildMapper.ruleToDomain(r as any)),
      binsSemChuva: binsSemChuva.map((b) => PrismaRiskChildMapper.binToDomain(b as any)),
      binsIntensidadeChuva: binsIntensidadeChuva.map((b) => PrismaRiskChildMapper.binToDomain(b as any)),
      binsPersistencia7d: binsPersistencia7d.map((b) => PrismaRiskChildMapper.binToDomain(b as any)),
      tempFactors: tempFactors.map((f) => PrismaRiskChildMapper.tempFactorToDomain(f as any)),
      ventoFactors: ventoFactors.map((f) => PrismaRiskChildMapper.ventoFactorToDomain(f as any)),
      tempAdjustPp: tempAdjustPp.map((a) => PrismaRiskChildMapper.tempAdjustToDomain(a as any)),
      ventoAdjustPp: ventoAdjustPp.map((a) => PrismaRiskChildMapper.ventoAdjustToDomain(a as any)),
      persistenciaAdjustPp: persistenciaAdjustPp.map((a) => PrismaRiskChildMapper.persistenciaAdjustToDomain(a as any)),
      tendenciaAdjustPp: tendenciaAdjustPp.map((a) => PrismaRiskChildMapper.tendenciaAdjustToDomain(a as any)),
    };
  }

  async getDroneConfig(clienteId: string): Promise<DroneRiskConfig | null> {
    const raw = await this.prisma.client.sentinela_drone_risk_config.findFirst({
      where: { cliente_id: clienteId },
    });
    return raw ? PrismaDroneRiskConfigMapper.toDomain(raw as any) : null;
  }

  async findYoloClassById(id: string): Promise<YoloClassConfig | null> {
    const raw = await this.prisma.client.sentinela_yolo_class_config.findUnique({ where: { id } });
    return raw ? PrismaYoloClassConfigMapper.toDomain(raw as any) : null;
  }

  async filterYoloClasses(clienteId: string): Promise<YoloClassConfig[]> {
    const rows = await this.prisma.client.sentinela_yolo_class_config.findMany({
      where: { cliente_id: clienteId },
      orderBy: { item_key: 'asc' },
    });
    return rows.map((r) => PrismaYoloClassConfigMapper.toDomain(r as any));
  }

  async filterYoloSynonyms(clienteId: string): Promise<YoloSynonym[]> {
    const rows = await this.prisma.client.sentinela_yolo_synonym.findMany({
      where: { cliente_id: clienteId },
      orderBy: { synonym: 'asc' },
    });
    return rows.map((r) => PrismaYoloSynonymMapper.toDomain(r as any));
  }
}
