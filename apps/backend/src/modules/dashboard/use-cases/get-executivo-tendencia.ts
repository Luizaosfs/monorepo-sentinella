import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '@shared/modules/database/prisma/prisma.service'

@Injectable()
export class GetExecutivoTendencia {
  constructor(private prisma: PrismaService) {}

  execute(clienteId: string) {
    return this.prisma.client.$queryRaw(Prisma.sql`
      WITH weeks AS (
        SELECT generate_series(
          date_trunc('week', CURRENT_DATE) - INTERVAL '7 weeks',
          date_trunc('week', CURRENT_DATE),
          INTERVAL '1 week'
        )::date AS semana_inicio
      ),
      score_stats AS (
        SELECT ROUND(AVG(ts.score)::numeric, 1) AS score_medio
        FROM territorio_score ts
        WHERE ts.cliente_id = ${clienteId}::uuid
      )
      SELECT
        ${clienteId}::uuid AS cliente_id,
        w.semana_inicio,
        COUNT(DISTINCT fr.id) FILTER (WHERE fr.created_at >= w.semana_inicio AND fr.created_at < w.semana_inicio + INTERVAL '7 days') AS focos_novos,
        COUNT(DISTINCT fr.id) FILTER (WHERE fr.resolvido_em >= w.semana_inicio AND fr.resolvido_em < w.semana_inicio + INTERVAL '7 days') AS focos_resolvidos,
        COUNT(DISTINCT v.id) FILTER (WHERE v.data_visita >= w.semana_inicio AND v.data_visita < w.semana_inicio + INTERVAL '7 days') AS vistorias,
        COUNT(DISTINCT cn.id) FILTER (WHERE cn.created_at >= w.semana_inicio AND cn.created_at < w.semana_inicio + INTERVAL '7 days') AS casos,
        ss.score_medio
      FROM weeks w
      CROSS JOIN score_stats ss
      LEFT JOIN focos_risco fr ON fr.cliente_id = ${clienteId}::uuid AND fr.deleted_at IS NULL
      LEFT JOIN vistorias v ON v.cliente_id = ${clienteId}::uuid AND v.deleted_at IS NULL
      LEFT JOIN casos_notificados cn ON cn.cliente_id = ${clienteId}::uuid AND cn.deleted_at IS NULL
      GROUP BY w.semana_inicio, ss.score_medio
      ORDER BY w.semana_inicio
    `)
  }
}
