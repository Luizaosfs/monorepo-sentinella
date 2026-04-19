import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '@shared/modules/database/prisma/prisma.service'

@Injectable()
export class GetAnaliticoResumo {
  constructor(private prisma: PrismaService) {}

  execute(clienteId: string) {
    return this.prisma.client.$queryRaw(Prisma.sql`
      SELECT
        cliente_id,
        COUNT(*) AS total_vistorias,
        COUNT(*) FILTER (WHERE prioridade_final = 'P1') AS p1_count,
        COUNT(*) FILTER (WHERE prioridade_final = 'P2') AS p2_count,
        COUNT(*) FILTER (WHERE prioridade_final = 'P3') AS p3_count,
        COUNT(*) FILTER (WHERE prioridade_final = 'P4') AS p4_count,
        COUNT(*) FILTER (WHERE prioridade_final = 'P5') AS p5_count,
        COUNT(*) FILTER (WHERE risco_vetorial IN ('alto','critico')) AS risco_vetorial_alto_count,
        COUNT(*) FILTER (WHERE risco_socioambiental = 'alto') AS risco_socio_alto_count
      FROM vistorias v
      WHERE cliente_id = ${clienteId}::uuid AND deleted_at IS NULL
      GROUP BY cliente_id
    `)
  }
}
