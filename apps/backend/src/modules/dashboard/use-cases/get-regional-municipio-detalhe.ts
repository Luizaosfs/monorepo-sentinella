import { Injectable, NotFoundException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '@shared/modules/database/prisma/prisma.service'

import { GetRegionalComparativo, ComparativoParams } from './get-regional-comparativo'
import { GetRegionalEvolucao, EvolucaoParams } from './get-regional-evolucao'
import { GetRegionalResumo } from './get-regional-resumo'

@Injectable()
export class GetRegionalMunicipioDetalhe {
  constructor(
    private prisma: PrismaService,
    private getRegionalResumo: GetRegionalResumo,
    private getRegionalEvolucao: GetRegionalEvolucao,
    private getRegionalComparativo: GetRegionalComparativo,
  ) {}

  async execute(clienteId: string) {
    const now = new Date()

    const evolucaoInicio = new Date(now)
    evolucaoInicio.setMonth(evolucaoInicio.getMonth() - 12)
    evolucaoInicio.setDate(1)
    evolucaoInicio.setHours(0, 0, 0, 0)

    const comparativoInicio = new Date(now)
    comparativoInicio.setDate(comparativoInicio.getDate() - 30)
    comparativoInicio.setHours(0, 0, 0, 0)
    const duracao = now.getTime() - comparativoInicio.getTime()

    const evolucaoParams: EvolucaoParams = { dataInicio: evolucaoInicio, dataFim: now }
    const comparativoParams: ComparativoParams = {
      dataInicio: comparativoInicio,
      dataFim: now,
      anteriorInicio: new Date(comparativoInicio.getTime() - duracao),
      anteriorFim: comparativoInicio,
    }

    const ids = [clienteId]

    const [resumoRows, vulnerabilidade, evolucao, comparativo] = await Promise.all([
      this.getRegionalResumo.execute(ids),
      this.queryVulnerabilidade(clienteId),
      this.getRegionalEvolucao.execute(ids, evolucaoParams),
      this.getRegionalComparativo.execute(ids, comparativoParams),
    ])

    const resumo = (resumoRows as any[])[0]
    if (!resumo) {
      throw new NotFoundException(`Cliente ${clienteId} não encontrado ou sem dados`)
    }

    return {
      cliente: {
        id: resumo.cliente_id as string,
        nome: resumo.municipio_nome as string,
        cidade: (resumo.cidade as string | null) ?? undefined,
        uf: (resumo.uf as string | null) ?? undefined,
      },
      resumo: {
        total_focos:                resumo.total_focos,
        focos_ativos:               resumo.focos_ativos,
        focos_resolvidos:           resumo.focos_resolvidos,
        focos_descartados:          resumo.focos_descartados,
        taxa_resolucao_pct:         resumo.taxa_resolucao_pct,
        sla_vencido_count:          resumo.sla_vencido_count,
        total_vistorias:            resumo.total_vistorias,
        vulnerabilidade_alta_count:    resumo.vulnerabilidade_alta_count,
        vulnerabilidade_critica_count: resumo.vulnerabilidade_critica_count,
        risco_vetorial_alto_count:     resumo.risco_vetorial_alto_count,
        risco_vetorial_critico_count:  resumo.risco_vetorial_critico_count,
        alerta_saude_urgente_count:    resumo.alerta_saude_urgente_count,
        prioridade_p1_count:           resumo.prioridade_p1_count,
        prioridade_p2_count:           resumo.prioridade_p2_count,
      },
      vulnerabilidade,
      evolucao,
      comparativo,
    }
  }

  private async queryVulnerabilidade(clienteId: string) {
    const zero = {
      total_vistorias: 0,
      vulnerabilidade_baixa: 0, vulnerabilidade_media: 0, vulnerabilidade_alta: 0, vulnerabilidade_critica: 0,
      risco_vetorial_baixo: 0, risco_vetorial_medio: 0, risco_vetorial_alto: 0, risco_vetorial_critico: 0,
      alerta_saude_normal: 0, alerta_saude_atencao: 0, alerta_saude_urgente: 0,
      prioridade_p1: 0, prioridade_p2: 0, prioridade_p3: 0, prioridade_p4: 0, prioridade_p5: 0,
    }

    const rows = await this.prisma.client.$queryRaw(Prisma.sql`
      SELECT
        COUNT(*)::int                                                              AS total_vistorias,
        COUNT(*) FILTER (WHERE v.vulnerabilidade_domiciliar = 'baixa')::int       AS vulnerabilidade_baixa,
        COUNT(*) FILTER (WHERE v.vulnerabilidade_domiciliar = 'media')::int       AS vulnerabilidade_media,
        COUNT(*) FILTER (WHERE v.vulnerabilidade_domiciliar = 'alta')::int        AS vulnerabilidade_alta,
        COUNT(*) FILTER (WHERE v.vulnerabilidade_domiciliar = 'critica')::int     AS vulnerabilidade_critica,
        COUNT(*) FILTER (WHERE v.risco_vetorial = 'baixo')::int                   AS risco_vetorial_baixo,
        COUNT(*) FILTER (WHERE v.risco_vetorial = 'medio')::int                   AS risco_vetorial_medio,
        COUNT(*) FILTER (WHERE v.risco_vetorial = 'alto')::int                    AS risco_vetorial_alto,
        COUNT(*) FILTER (WHERE v.risco_vetorial = 'critico')::int                 AS risco_vetorial_critico,
        COUNT(*) FILTER (WHERE v.alerta_saude = 'normal')::int                    AS alerta_saude_normal,
        COUNT(*) FILTER (WHERE v.alerta_saude = 'atencao')::int                   AS alerta_saude_atencao,
        COUNT(*) FILTER (WHERE v.alerta_saude = 'urgente')::int                   AS alerta_saude_urgente,
        COUNT(*) FILTER (WHERE v.prioridade_final = 'P1')::int                    AS prioridade_p1,
        COUNT(*) FILTER (WHERE v.prioridade_final = 'P2')::int                    AS prioridade_p2,
        COUNT(*) FILTER (WHERE v.prioridade_final = 'P3')::int                    AS prioridade_p3,
        COUNT(*) FILTER (WHERE v.prioridade_final = 'P4')::int                    AS prioridade_p4,
        COUNT(*) FILTER (WHERE v.prioridade_final = 'P5')::int                    AS prioridade_p5
      FROM vistorias v
      WHERE v.deleted_at IS NULL
        AND v.cliente_id = ${clienteId}::uuid
    `) as any[]

    return rows[0] ?? zero
  }
}
