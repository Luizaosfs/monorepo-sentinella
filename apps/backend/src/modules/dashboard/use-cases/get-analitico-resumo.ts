import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '@shared/modules/database/prisma/prisma.service'

@Injectable()
export class GetAnaliticoResumo {
  constructor(private prisma: PrismaService) {}

  async execute(clienteId: string) {
    const rows = await this.prisma.client.$queryRaw<unknown[]>(Prisma.sql`
      SELECT
        cliente_id,
        COUNT(*)::int                                                                          AS total_vistorias,
        COUNT(*) FILTER (WHERE acesso_realizado = true)::int                                   AS visitados_count,
        COUNT(*) FILTER (WHERE acesso_realizado = false)::int                                  AS sem_acesso_count,
        ROUND(
          COUNT(*) FILTER (WHERE acesso_realizado = true)::numeric
          / NULLIF(COUNT(*), 0) * 100, 1
        )::float                                                                               AS taxa_acesso_pct,
        COUNT(*) FILTER (WHERE alerta_saude = 'urgente')::int                                  AS alertas_urgentes,
        COUNT(*) FILTER (WHERE vulnerabilidade_domiciliar IN ('alta','critica'))::int           AS vulnerabilidade_alta_count,
        COUNT(*) FILTER (WHERE risco_vetorial IN ('alto','critico'))::int                      AS risco_vetorial_alto_count,
        COUNT(*) FILTER (WHERE risco_socioambiental = 'alto')::int                             AS risco_socio_alto_count,
        COUNT(*) FILTER (WHERE prioridade_final = 'P1')::int                                   AS p1_count,
        COUNT(*) FILTER (WHERE prioridade_final = 'P2')::int                                   AS p2_count,
        COUNT(*) FILTER (WHERE prioridade_final = 'P3')::int                                   AS p3_count,
        COUNT(*) FILTER (WHERE prioridade_final = 'P4')::int                                   AS p4_count,
        COUNT(*) FILTER (WHERE prioridade_final = 'P5')::int                                   AS p5_count
      FROM vistorias v
      WHERE cliente_id = ${clienteId}::uuid AND deleted_at IS NULL
      GROUP BY cliente_id
    `)
    return rows[0] ?? null
  }
}
