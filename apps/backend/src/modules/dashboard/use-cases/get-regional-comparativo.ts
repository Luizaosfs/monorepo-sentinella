import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '@shared/modules/database/prisma/prisma.service'

export interface ComparativoParams {
  dataInicio: Date
  dataFim: Date
  anteriorInicio: Date
  anteriorFim: Date
}

interface PeriodoRow {
  total_focos: number
  focos_ativos: number
  focos_resolvidos: number
  focos_descartados: number
  taxa_resolucao_pct: number
  total_vistorias: number
  vulnerabilidade_critica_count: number
  risco_vetorial_critico_count: number
  alerta_saude_urgente_count: number
  prioridade_p1_count: number
}

const round1 = (n: number) => Math.round(n * 10) / 10

function variacaoPct(atual: number, anterior: number): number | null {
  if (anterior === 0) return atual === 0 ? 0 : null
  return round1(((atual - anterior) / anterior) * 100)
}

@Injectable()
export class GetRegionalComparativo {
  constructor(private prisma: PrismaService) {}

  async execute(clienteIds: string[] | null, params: ComparativoParams) {
    if (clienteIds !== null && clienteIds.length === 0) {
      return this.buildResponse(params, this.zeroPeriodo(), this.zeroPeriodo())
    }

    const [atual, anterior] = await Promise.all([
      this.calcularPeriodo(clienteIds, params.dataInicio, params.dataFim),
      this.calcularPeriodo(clienteIds, params.anteriorInicio, params.anteriorFim),
    ])

    return this.buildResponse(params, atual, anterior)
  }

  private zeroPeriodo(): PeriodoRow {
    return {
      total_focos: 0, focos_ativos: 0, focos_resolvidos: 0, focos_descartados: 0,
      taxa_resolucao_pct: 0, total_vistorias: 0,
      vulnerabilidade_critica_count: 0, risco_vetorial_critico_count: 0,
      alerta_saude_urgente_count: 0, prioridade_p1_count: 0,
    }
  }

  private async calcularPeriodo(
    clienteIds: string[] | null,
    inicio: Date,
    fim: Date,
  ): Promise<PeriodoRow> {
    const filtroFoco =
      clienteIds === null
        ? Prisma.empty
        : Prisma.sql`AND fr.cliente_id = ANY(ARRAY[${Prisma.join(
            clienteIds.map((id) => Prisma.sql`${id}::uuid`),
          )}]::uuid[])`

    const filtroVistoria =
      clienteIds === null
        ? Prisma.empty
        : Prisma.sql`AND v.cliente_id = ANY(ARRAY[${Prisma.join(
            clienteIds.map((id) => Prisma.sql`${id}::uuid`),
          )}]::uuid[])`

    const rows = await this.prisma.client.$queryRaw(Prisma.sql`
      WITH focos_p AS (
        SELECT
          COUNT(*)::int                                                                         AS total_focos,
          COUNT(*) FILTER (WHERE fr.status NOT IN ('suspeita', 'descartado', 'resolvido'))::int AS focos_ativos,
          COUNT(*) FILTER (WHERE fr.status = 'resolvido')::int                                 AS focos_resolvidos,
          COUNT(*) FILTER (WHERE fr.status = 'descartado')::int                                AS focos_descartados
        FROM focos_risco fr
        WHERE fr.deleted_at IS NULL
          AND fr.created_at >= ${inicio}
          AND fr.created_at <  ${fim}
          ${filtroFoco}
      ),
      vistorias_p AS (
        SELECT
          COUNT(*)::int                                                                        AS total_vistorias,
          COUNT(*) FILTER (WHERE v.vulnerabilidade_domiciliar = 'critica')::int               AS vulnerabilidade_critica_count,
          COUNT(*) FILTER (WHERE v.risco_vetorial = 'critico')::int                           AS risco_vetorial_critico_count,
          COUNT(*) FILTER (WHERE v.alerta_saude = 'urgente')::int                             AS alerta_saude_urgente_count,
          COUNT(*) FILTER (WHERE v.prioridade_final = 'P1')::int                              AS prioridade_p1_count
        FROM vistorias v
        WHERE v.deleted_at IS NULL
          AND v.created_at >= ${inicio}
          AND v.created_at <  ${fim}
          ${filtroVistoria}
      )
      SELECT
        f.total_focos,
        f.focos_ativos,
        f.focos_resolvidos,
        f.focos_descartados,
        ROUND(
          CASE WHEN f.total_focos > 0
               THEN f.focos_resolvidos::numeric / f.total_focos * 100
               ELSE 0
          END, 1
        )::float8 AS taxa_resolucao_pct,
        v.total_vistorias,
        v.vulnerabilidade_critica_count,
        v.risco_vetorial_critico_count,
        v.alerta_saude_urgente_count,
        v.prioridade_p1_count
      FROM focos_p f, vistorias_p v
    `) as PeriodoRow[]

    return rows[0] ?? this.zeroPeriodo()
  }

  private buildResponse(params: ComparativoParams, atual: PeriodoRow, anterior: PeriodoRow) {
    return {
      periodo_atual: {
        data_inicio: params.dataInicio.toISOString().slice(0, 10),
        data_fim:    params.dataFim.toISOString().slice(0, 10),
        ...atual,
      },
      periodo_anterior: {
        data_inicio: params.anteriorInicio.toISOString().slice(0, 10),
        data_fim:    params.anteriorFim.toISOString().slice(0, 10),
        ...anterior,
      },
      variacao: {
        total_focos_pct:             variacaoPct(atual.total_focos, anterior.total_focos),
        focos_ativos_pct:            variacaoPct(atual.focos_ativos, anterior.focos_ativos),
        focos_resolvidos_pct:        variacaoPct(atual.focos_resolvidos, anterior.focos_resolvidos),
        taxa_resolucao_pp:           round1(atual.taxa_resolucao_pct - anterior.taxa_resolucao_pct),
        total_vistorias_pct:         variacaoPct(atual.total_vistorias, anterior.total_vistorias),
        vulnerabilidade_critica_pct: variacaoPct(atual.vulnerabilidade_critica_count, anterior.vulnerabilidade_critica_count),
        risco_vetorial_critico_pct:  variacaoPct(atual.risco_vetorial_critico_count, anterior.risco_vetorial_critico_count),
        alerta_saude_urgente_pct:    variacaoPct(atual.alerta_saude_urgente_count, anterior.alerta_saude_urgente_count),
        prioridade_p1_pct:           variacaoPct(atual.prioridade_p1_count, anterior.prioridade_p1_count),
      },
    }
  }
}
