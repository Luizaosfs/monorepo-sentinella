import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '@shared/modules/database/prisma/prisma.service'

export interface EvolucaoParams {
  dataInicio: Date
  dataFim: Date
}

@Injectable()
export class GetRegionalEvolucao {
  constructor(private prisma: PrismaService) {}

  async execute(clienteIds: string[] | null, params: EvolucaoParams) {
    if (clienteIds !== null && clienteIds.length === 0) return []

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

    return this.prisma.client.$queryRaw(Prisma.sql`
      WITH focos_mensal AS (
        SELECT
          date_trunc('month', fr.created_at)::date                                            AS mes,
          COUNT(*)::int                                                                        AS total_focos,
          COUNT(*) FILTER (WHERE fr.status NOT IN ('suspeita', 'descartado', 'resolvido'))::int AS focos_ativos,
          COUNT(*) FILTER (WHERE fr.status = 'resolvido')::int                                AS focos_resolvidos,
          COUNT(*) FILTER (WHERE fr.status = 'descartado')::int                               AS focos_descartados
        FROM focos_risco fr
        WHERE fr.deleted_at IS NULL
          AND fr.created_at >= ${params.dataInicio}
          AND fr.created_at <  ${params.dataFim}
          ${filtroFoco}
        GROUP BY 1
      ),
      vistorias_mensal AS (
        SELECT
          date_trunc('month', v.created_at)::date                                             AS mes,
          COUNT(*)::int                                                                        AS total_vistorias,
          COUNT(*) FILTER (WHERE v.vulnerabilidade_domiciliar = 'critica')::int               AS vulnerabilidade_critica_count,
          COUNT(*) FILTER (WHERE v.risco_vetorial = 'critico')::int                           AS risco_vetorial_critico_count,
          COUNT(*) FILTER (WHERE v.alerta_saude = 'urgente')::int                             AS alerta_saude_urgente_count,
          COUNT(*) FILTER (WHERE v.prioridade_final = 'P1')::int                              AS prioridade_p1_count
        FROM vistorias v
        WHERE v.deleted_at IS NULL
          AND v.created_at >= ${params.dataInicio}
          AND v.created_at <  ${params.dataFim}
          ${filtroVistoria}
        GROUP BY 1
      )
      SELECT
        TO_CHAR(COALESCE(f.mes, v.mes), 'YYYY-MM')               AS periodo,
        COALESCE(f.total_focos, 0)                                AS total_focos,
        COALESCE(f.focos_ativos, 0)                               AS focos_ativos,
        COALESCE(f.focos_resolvidos, 0)                           AS focos_resolvidos,
        COALESCE(f.focos_descartados, 0)                          AS focos_descartados,
        ROUND(
          CASE
            WHEN COALESCE(f.focos_resolvidos, 0) + COALESCE(f.focos_ativos, 0) > 0
            THEN COALESCE(f.focos_resolvidos, 0)::numeric
               / (COALESCE(f.focos_resolvidos, 0) + COALESCE(f.focos_ativos, 0))::numeric * 100
            ELSE 0
          END, 1
        )::float8                                                  AS taxa_resolucao_pct,
        0                                                          AS sla_vencido_count,
        COALESCE(v.total_vistorias, 0)                            AS total_vistorias,
        COALESCE(v.vulnerabilidade_critica_count, 0)              AS vulnerabilidade_critica_count,
        COALESCE(v.risco_vetorial_critico_count, 0)               AS risco_vetorial_critico_count,
        COALESCE(v.alerta_saude_urgente_count, 0)                 AS alerta_saude_urgente_count,
        COALESCE(v.prioridade_p1_count, 0)                        AS prioridade_p1_count
      FROM focos_mensal f
      FULL OUTER JOIN vistorias_mensal v ON f.mes = v.mes
      ORDER BY COALESCE(f.mes, v.mes) ASC
    `)
  }
}
