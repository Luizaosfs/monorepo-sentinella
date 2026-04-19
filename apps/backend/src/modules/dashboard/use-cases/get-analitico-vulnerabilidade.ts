import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '@shared/modules/database/prisma/prisma.service'

@Injectable()
export class GetAnaliticoVulnerabilidade {
  constructor(private prisma: PrismaService) {}

  execute(clienteId: string) {
    return this.prisma.client.$queryRaw(Prisma.sql`
      SELECT
        v.cliente_id,
        COALESCE(im.bairro, '(sem bairro)') AS bairro,
        v.vulnerabilidade_domiciliar,
        COUNT(*) AS total
      FROM vistorias v
      JOIN imoveis im ON im.id = v.imovel_id AND im.deleted_at IS NULL
      WHERE v.cliente_id = ${clienteId}::uuid AND v.deleted_at IS NULL AND v.vulnerabilidade_domiciliar IS NOT NULL
      GROUP BY v.cliente_id, im.bairro, v.vulnerabilidade_domiciliar
    `)
  }
}
