import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '@shared/modules/database/prisma/prisma.service'

@Injectable()
export class GetAnaliticoRiscoTerritorial {
  constructor(private prisma: PrismaService) {}

  execute(clienteId: string) {
    return this.prisma.client.$queryRaw(Prisma.sql`
      SELECT
        v.cliente_id,
        COALESCE(im.bairro, '(sem bairro)') AS bairro,
        im.regiao_id,
        COUNT(*) AS total_vistorias,
        COUNT(*) FILTER (WHERE v.prioridade_final = ANY(ARRAY['P1','P2'])) AS criticos,
        ROUND(COUNT(*) FILTER (WHERE v.prioridade_final = ANY(ARRAY['P1','P2']))::numeric / NULLIF(COUNT(*),0), 1) AS pct_criticos
      FROM vistorias v
      JOIN imoveis im ON im.id = v.imovel_id AND im.deleted_at IS NULL
      WHERE v.cliente_id = ${clienteId}::uuid AND v.deleted_at IS NULL
      GROUP BY v.cliente_id, im.bairro, im.regiao_id
    `)
  }
}
