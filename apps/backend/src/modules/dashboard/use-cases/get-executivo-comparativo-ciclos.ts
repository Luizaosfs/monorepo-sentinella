import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '@shared/modules/database/prisma/prisma.service'

@Injectable()
export class GetExecutivoComparativoCiclos {
  constructor(private prisma: PrismaService) {}

  execute(clienteId: string) {
    return this.prisma.client.$queryRaw(Prisma.sql`
      WITH ciclos AS (
        SELECT
          (date_trunc('month', CURRENT_DATE) - ((EXTRACT(MONTH FROM CURRENT_DATE)::int % 2) * INTERVAL '1 month'))::date AS ciclo_atual_inicio,
          (date_trunc('month', CURRENT_DATE) - ((EXTRACT(MONTH FROM CURRENT_DATE)::int % 2) * INTERVAL '1 month') - INTERVAL '2 months')::date AS ciclo_anterior_inicio
      )
      SELECT
        ${clienteId}::uuid AS cliente_id,
        ci.ciclo_atual_inicio,
        ci.ciclo_anterior_inicio,
        COUNT(DISTINCT fr.id) FILTER (WHERE fr.created_at >= ci.ciclo_atual_inicio AND fr.created_at < ci.ciclo_atual_inicio + INTERVAL '2 months') AS focos_atual,
        COUNT(DISTINCT fr.id) FILTER (WHERE fr.created_at >= ci.ciclo_anterior_inicio AND fr.created_at < ci.ciclo_anterior_inicio + INTERVAL '2 months') AS focos_anterior,
        COUNT(DISTINCT fr.id) FILTER (WHERE fr.resolvido_em >= ci.ciclo_atual_inicio AND fr.resolvido_em < ci.ciclo_atual_inicio + INTERVAL '2 months') AS resolucao_atual,
        COUNT(DISTINCT fr.id) FILTER (WHERE fr.resolvido_em >= ci.ciclo_anterior_inicio AND fr.resolvido_em < ci.ciclo_anterior_inicio + INTERVAL '2 months') AS resolucao_anterior,
        COUNT(DISTINCT v.id) FILTER (WHERE v.data_visita >= ci.ciclo_atual_inicio AND v.data_visita < ci.ciclo_atual_inicio + INTERVAL '2 months') AS vistorias_atual,
        COUNT(DISTINCT v.id) FILTER (WHERE v.data_visita >= ci.ciclo_anterior_inicio AND v.data_visita < ci.ciclo_anterior_inicio + INTERVAL '2 months') AS vistorias_anterior,
        COUNT(DISTINCT cn.id) FILTER (WHERE cn.created_at >= ci.ciclo_atual_inicio AND cn.created_at < ci.ciclo_atual_inicio + INTERVAL '2 months') AS casos_atual,
        COUNT(DISTINCT cn.id) FILTER (WHERE cn.created_at >= ci.ciclo_anterior_inicio AND cn.created_at < ci.ciclo_anterior_inicio + INTERVAL '2 months') AS casos_anterior,
        ROUND(
          (COUNT(DISTINCT fr.id) FILTER (WHERE fr.created_at >= ci.ciclo_atual_inicio AND fr.created_at < ci.ciclo_atual_inicio + INTERVAL '2 months')
           - COUNT(DISTINCT fr.id) FILTER (WHERE fr.created_at >= ci.ciclo_anterior_inicio AND fr.created_at < ci.ciclo_anterior_inicio + INTERVAL '2 months')) * 100.0
          / NULLIF(COUNT(DISTINCT fr.id) FILTER (WHERE fr.created_at >= ci.ciclo_anterior_inicio AND fr.created_at < ci.ciclo_anterior_inicio + INTERVAL '2 months'), 0), 1
        ) AS variacao_focos_pct,
        ROUND(
          (COUNT(DISTINCT fr.id) FILTER (WHERE fr.resolvido_em >= ci.ciclo_atual_inicio AND fr.resolvido_em < ci.ciclo_atual_inicio + INTERVAL '2 months')
           - COUNT(DISTINCT fr.id) FILTER (WHERE fr.resolvido_em >= ci.ciclo_anterior_inicio AND fr.resolvido_em < ci.ciclo_anterior_inicio + INTERVAL '2 months')) * 100.0
          / NULLIF(COUNT(DISTINCT fr.id) FILTER (WHERE fr.resolvido_em >= ci.ciclo_anterior_inicio AND fr.resolvido_em < ci.ciclo_anterior_inicio + INTERVAL '2 months'), 0), 1
        ) AS variacao_resolucao_pct
      FROM ciclos ci
      LEFT JOIN focos_risco fr ON fr.cliente_id = ${clienteId}::uuid AND fr.deleted_at IS NULL
      LEFT JOIN vistorias v ON v.cliente_id = ${clienteId}::uuid AND v.deleted_at IS NULL
      LEFT JOIN casos_notificados cn ON cn.cliente_id = ${clienteId}::uuid AND cn.deleted_at IS NULL
      GROUP BY ci.ciclo_atual_inicio, ci.ciclo_anterior_inicio
    `)
  }
}
