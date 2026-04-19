import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '@shared/modules/database/prisma/prisma.service'

@Injectable()
export class GetReincidenciaSazonalidade {
  constructor(private prisma: PrismaService) {}

  execute(clienteId: string) {
    return this.prisma.client.$queryRaw(Prisma.sql`
      SELECT
        fr.cliente_id,
        im.bairro,
        im.regiao_id,
        fr.ciclo,
        COUNT(fr.id) AS focos_total,
        COUNT(fr.id) FILTER (WHERE fr.foco_anterior_id IS NOT NULL) AS focos_reincidentes,
        COUNT(fr.id) FILTER (WHERE fr.status = 'resolvido') AS focos_resolvidos,
        ROUND(COUNT(fr.id) FILTER (WHERE fr.foco_anterior_id IS NOT NULL)::numeric / NULLIF(COUNT(fr.id), 0) * 100, 1) AS taxa_reincidencia_pct
      FROM focos_risco fr
      JOIN imoveis im ON im.id = fr.imovel_id AND im.deleted_at IS NULL
      WHERE fr.cliente_id = ${clienteId}::uuid AND fr.imovel_id IS NOT NULL
        AND fr.ciclo IS NOT NULL AND fr.deleted_at IS NULL AND im.deleted_at IS NULL
      GROUP BY fr.cliente_id, im.bairro, im.regiao_id, fr.ciclo
      HAVING COUNT(fr.id) >= 2
      ORDER BY focos_reincidentes DESC
    `)
  }
}
