import { SaveDroneConfigInput } from '@modules/risk-engine/dtos/save-risk-policy.body';
import {
  DroneRiskConfig,
  RiskPolicy,
  RiskPolicyFull,
  YoloClassConfig,
  YoloSynonym,
} from '@modules/risk-engine/entities/risk-engine';
import {
  RiskEngineWriteRepository,
  ScoreConfigInput,
} from '@modules/risk-engine/repositories/risk-engine-write.repository';
import { ScoreConfig } from '@modules/risk-engine/repositories/risk-engine-read.repository';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaRepository } from '@/decorators/prisma-repository.decorator';

import {
  PrismaDroneRiskConfigMapper,
  PrismaRiskPolicyMapper,
  PrismaYoloClassConfigMapper,
  PrismaYoloSynonymMapper,
} from '../../mappers/prisma-risk-engine.mapper';
import { PrismaService } from '../../prisma.service';

@PrismaRepository(RiskEngineWriteRepository)
@Injectable()
export class PrismaRiskEngineWriteRepository implements RiskEngineWriteRepository {
  constructor(private prisma: PrismaService) {}

  async createPolicy(policy: RiskPolicy): Promise<RiskPolicy> {
    const data = PrismaRiskPolicyMapper.toPrisma(policy);
    const created = await this.prisma.client.sentinela_risk_policy.create({ data });
    return PrismaRiskPolicyMapper.toDomain(created as any);
  }

  async savePolicy(policy: RiskPolicy): Promise<void> {
    const data = PrismaRiskPolicyMapper.toPrisma(policy);
    await this.prisma.client.sentinela_risk_policy.updateMany({ where: { id: policy.id, cliente_id: policy.clienteId }, data });
  }

  async deletePolicy(id: string): Promise<void> {
    await this.prisma.client.sentinela_risk_policy.delete({ where: { id } });
  }

  async savePolicyFull(policyId: string, full: Omit<RiskPolicyFull, 'policy'>): Promise<void> {
    await this.prisma.client.$transaction(async (tx) => {
      await Promise.all([
        tx.sentinela_risk_defaults.deleteMany({ where: { policy_id: policyId } }),
        tx.sentinela_risk_fallback_rule.deleteMany({ where: { policy_id: policyId } }),
        tx.sentinela_risk_rule.deleteMany({ where: { policy_id: policyId } }),
        tx.sentinela_risk_bin_sem_chuva.deleteMany({ where: { policy_id: policyId } }),
        tx.sentinela_risk_bin_intensidade_chuva.deleteMany({ where: { policy_id: policyId } }),
        tx.sentinela_risk_bin_persistencia_7d.deleteMany({ where: { policy_id: policyId } }),
        tx.sentinela_risk_temp_factor.deleteMany({ where: { policy_id: policyId } }),
        tx.sentinela_risk_vento_factor.deleteMany({ where: { policy_id: policyId } }),
        tx.sentinela_risk_temp_adjust_pp.deleteMany({ where: { policy_id: policyId } }),
        tx.sentinela_risk_vento_adjust_pp.deleteMany({ where: { policy_id: policyId } }),
        tx.sentinela_risk_persistencia_adjust_pp.deleteMany({ where: { policy_id: policyId } }),
        tx.sentinela_risk_tendencia_adjust_pp.deleteMany({ where: { policy_id: policyId } }),
      ]);

      const inserts: Promise<unknown>[] = [];

      if (full.defaults) {
        inserts.push(tx.sentinela_risk_defaults.create({
          data: {
            policy_id: policyId,
            chuva_relevante_mm: full.defaults.chuvaRelevantemm,
            dias_lookup_max: full.defaults.diasLookupMax,
            tendencia_dias: full.defaults.tendenciaDias,
          },
        }));
      }

      if (full.fallbackRule) {
        inserts.push(tx.sentinela_risk_fallback_rule.create({
          data: {
            policy_id: policyId,
            situacao_ambiental: full.fallbackRule.situacaoAmbiental,
            probabilidade_label: full.fallbackRule.probabilidadeLabel,
            probabilidade_pct_min: full.fallbackRule.probabilidadePctMin,
            probabilidade_pct_max: full.fallbackRule.probabilidadePctMax,
            classificacao: full.fallbackRule.classificacao,
            icone: full.fallbackRule.icone,
            severity: full.fallbackRule.severity,
          },
        }));
      }

      if (full.rules.length) {
        inserts.push(tx.sentinela_risk_rule.createMany({
          data: full.rules.map((r) => ({
            policy_id: policyId, idx: r.idx,
            chuva_mm_min: r.chuvaMMMin, chuva_mm_max: r.chuvaMMMax,
            dias_min: r.diasMin, dias_max: r.diasMax,
            situacao_ambiental: r.situacaoAmbiental,
            probabilidade_label: r.probabilidadeLabel,
            probabilidade_pct_min: r.probabilidadePctMin,
            probabilidade_pct_max: r.probabilidadePctMax,
            classificacao: r.classificacao, icone: r.icone, severity: r.severity,
          })),
        }));
      }

      if (full.binsSemChuva.length) {
        inserts.push(tx.sentinela_risk_bin_sem_chuva.createMany({
          data: full.binsSemChuva.map((b) => ({ policy_id: policyId, idx: b.idx, min_val: b.minVal, max_val: b.maxVal })),
        }));
      }
      if (full.binsIntensidadeChuva.length) {
        inserts.push(tx.sentinela_risk_bin_intensidade_chuva.createMany({
          data: full.binsIntensidadeChuva.map((b) => ({ policy_id: policyId, idx: b.idx, min_val: b.minVal, max_val: b.maxVal })),
        }));
      }
      if (full.binsPersistencia7d.length) {
        inserts.push(tx.sentinela_risk_bin_persistencia_7d.createMany({
          data: full.binsPersistencia7d.map((b) => ({ policy_id: policyId, idx: b.idx, min_val: b.minVal, max_val: b.maxVal })),
        }));
      }
      if (full.tempFactors.length) {
        inserts.push(tx.sentinela_risk_temp_factor.createMany({
          data: full.tempFactors.map((f) => ({ policy_id: policyId, idx: f.idx, temp_min: f.minVal, temp_max: f.maxVal, factor: f.factor })),
        }));
      }
      if (full.ventoFactors.length) {
        inserts.push(tx.sentinela_risk_vento_factor.createMany({
          data: full.ventoFactors.map((f) => ({ policy_id: policyId, idx: f.idx, vento_min: f.minVal, vento_max: f.maxVal, factor: f.factor })),
        }));
      }
      if (full.tempAdjustPp.length) {
        inserts.push(tx.sentinela_risk_temp_adjust_pp.createMany({
          data: full.tempAdjustPp.map((a) => ({ policy_id: policyId, idx: a.idx, temp_min: a.minVal, temp_max: a.maxVal, delta_pp: a.deltaPp })),
        }));
      }
      if (full.ventoAdjustPp.length) {
        inserts.push(tx.sentinela_risk_vento_adjust_pp.createMany({
          data: full.ventoAdjustPp.map((a) => ({ policy_id: policyId, idx: a.idx, vento_min: a.minVal, vento_max: a.maxVal, delta_pp: a.deltaPp })),
        }));
      }
      if (full.persistenciaAdjustPp.length) {
        inserts.push(tx.sentinela_risk_persistencia_adjust_pp.createMany({
          data: full.persistenciaAdjustPp.map((a) => ({ policy_id: policyId, idx: a.idx, dias_min: a.minVal, dias_max: a.maxVal, delta_pp: a.deltaPp })),
        }));
      }
      if (full.tendenciaAdjustPp.length) {
        inserts.push(tx.sentinela_risk_tendencia_adjust_pp.createMany({
          data: full.tendenciaAdjustPp.map((t) => ({ policy_id: policyId, tendencia: t.tendencia, delta_pp: t.deltaPp })),
        }));
      }

      await Promise.all(inserts);
    });
  }

  async saveDroneConfig(clienteId: string, data: SaveDroneConfigInput): Promise<DroneRiskConfig> {
    const existing = await this.prisma.client.sentinela_drone_risk_config.findFirst({
      where: { cliente_id: clienteId },
    });

    const payload = {
      ...(data.baseByRisco && {
        base_by_risco: data.baseByRisco as Prisma.InputJsonValue,
      }),
      ...(data.priorityThresholds && {
        priority_thresholds: data.priorityThresholds as Prisma.InputJsonValue,
      }),
      ...(data.slaByPriorityHours && {
        sla_by_priority_hours: data.slaByPriorityHours as Prisma.InputJsonValue,
      }),
      ...(data.confidenceMultiplier !== undefined && {
        confidence_multiplier: data.confidenceMultiplier,
      }),
      ...(data.itemOverrides && {
        item_overrides: data.itemOverrides as Prisma.InputJsonValue,
      }),
      updated_at: new Date(),
    };

    let raw: any;
    if (existing) {
      raw = await this.prisma.client.sentinela_drone_risk_config.update({
        where: { id: existing.id },
        data: payload,
      });
    } else {
      raw = await this.prisma.client.sentinela_drone_risk_config.create({
        data: { cliente_id: clienteId, ...payload },
      });
    }

    return PrismaDroneRiskConfigMapper.toDomain(raw as any);
  }

  async saveYoloClass(config: YoloClassConfig): Promise<void> {
    const data = PrismaYoloClassConfigMapper.toPrisma(config);
    await this.prisma.client.sentinela_yolo_class_config.update({
      where: { id: config.id },
      data,
    });
  }

  async createYoloSynonym(synonym: YoloSynonym): Promise<YoloSynonym> {
    const created = await this.prisma.client.sentinela_yolo_synonym.create({
      data: {
        cliente_id: synonym.clienteId,
        synonym: synonym.synonym,
        maps_to: synonym.mapsTo,
      },
    });
    return PrismaYoloSynonymMapper.toDomain(created as any);
  }

  async deleteYoloSynonym(id: string, clienteId?: string): Promise<void> {
    if (clienteId) {
      await this.prisma.client.sentinela_yolo_synonym.deleteMany({ where: { id, cliente_id: clienteId } });
    } else {
      await this.prisma.client.sentinela_yolo_synonym.delete({ where: { id } });
    }
  }

  async upsertScoreConfig(clienteId: string, data: ScoreConfigInput): Promise<ScoreConfig> {
    const payload: Record<string, unknown> = { updated_at: new Date() };
    if (data.pesoFocoSuspeito !== undefined) payload.peso_foco_suspeito = data.pesoFocoSuspeito;
    if (data.pesoFocoConfirmado !== undefined) payload.peso_foco_confirmado = data.pesoFocoConfirmado;
    if (data.pesoFocoEmTratamento !== undefined) payload.peso_foco_em_tratamento = data.pesoFocoEmTratamento;
    if (data.pesoFocoRecorrente !== undefined) payload.peso_foco_recorrente = data.pesoFocoRecorrente;
    if (data.pesoHistorico3focos !== undefined) payload.peso_historico_3focos = data.pesoHistorico3focos;
    if (data.pesoCaso300m !== undefined) payload.peso_caso_300m = data.pesoCaso300m;
    if (data.pesoChuvaAlta !== undefined) payload.peso_chuva_alta = data.pesoChuvaAlta;
    if (data.pesoTemperatura30 !== undefined) payload.peso_temperatura_30 = data.pesoTemperatura30;
    if (data.pesoDenunciaCidadao !== undefined) payload.peso_denuncia_cidadao = data.pesoDenunciaCidadao;
    if (data.pesoImovelRecusa !== undefined) payload.peso_imovel_recusa = data.pesoImovelRecusa;
    if (data.pesoSlaVencido !== undefined) payload.peso_sla_vencido = data.pesoSlaVencido;
    if (data.pesoFocoResolvido !== undefined) payload.peso_foco_resolvido = data.pesoFocoResolvido;
    if (data.pesoVistoriaNegativa !== undefined) payload.peso_vistoria_negativa = data.pesoVistoriaNegativa;
    if (data.janelaResolucaoDias !== undefined) payload.janela_resolucao_dias = data.janelaResolucaoDias;
    if (data.janelaVistoriaDias !== undefined) payload.janela_vistoria_dias = data.janelaVistoriaDias;
    if (data.janelaCasoDias !== undefined) payload.janela_caso_dias = data.janelaCasoDias;
    if (data.capFocos !== undefined) payload.cap_focos = data.capFocos;
    if (data.capEpidemio !== undefined) payload.cap_epidemio = data.capEpidemio;
    if (data.capHistorico !== undefined) payload.cap_historico = data.capHistorico;

    const raw = await this.prisma.client.score_config.upsert({
      where: { cliente_id: clienteId },
      update: payload as any,
      create: { cliente_id: clienteId, ...payload } as any,
    });

    return {
      clienteId: raw.cliente_id,
      pesoFocoSuspeito: raw.peso_foco_suspeito,
      pesoFocoConfirmado: raw.peso_foco_confirmado,
      pesoFocoEmTratamento: raw.peso_foco_em_tratamento,
      pesoFocoRecorrente: raw.peso_foco_recorrente,
      pesoHistorico3focos: raw.peso_historico_3focos,
      pesoCaso300m: raw.peso_caso_300m,
      pesoChuvaAlta: raw.peso_chuva_alta,
      pesoTemperatura30: raw.peso_temperatura_30,
      pesoDenunciaCidadao: raw.peso_denuncia_cidadao,
      pesoImovelRecusa: raw.peso_imovel_recusa,
      pesoSlaVencido: raw.peso_sla_vencido,
      pesoFocoResolvido: raw.peso_foco_resolvido,
      pesoVistoriaNegativa: raw.peso_vistoria_negativa,
      janelaResolucaoDias: raw.janela_resolucao_dias,
      janelaVistoriaDias: raw.janela_vistoria_dias,
      janelaCasoDias: raw.janela_caso_dias,
      capFocos: raw.cap_focos,
      capEpidemio: raw.cap_epidemio,
      capHistorico: raw.cap_historico,
      updatedAt: raw.updated_at,
    };
  }

  async enqueueScoreRecalculo(clienteId: string): Promise<void> {
    await this.prisma.client.job_queue.create({
      data: {
        tipo: 'score-worker',
        payload: { clienteId } as any,
        status: 'pendente',
        tentativas: 0,
        max_tentativas: 3,
        executar_em: new Date(),
      },
    });
  }
}
