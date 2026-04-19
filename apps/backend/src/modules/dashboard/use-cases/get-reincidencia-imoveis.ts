import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '@shared/modules/database/prisma/prisma.service'

@Injectable()
export class GetReincidenciaImoveis {
  constructor(private prisma: PrismaService) {}

  execute(clienteId: string) {
    return this.prisma.client.$queryRaw(Prisma.sql`
      WITH cadeia_focos AS (
        SELECT
          fr.cliente_id,
          fr.imovel_id,
          COUNT(fr.id) AS total_focos_historico,
          COUNT(fr.id) FILTER (WHERE fr.foco_anterior_id IS NOT NULL) AS focos_reincidentes,
          MAX(fr.created_at) AS ultimo_foco_em,
          COUNT(fr.id) FILTER (WHERE fr.status NOT IN ('resolvido','descartado')) AS focos_ativos_atual
        FROM focos_risco fr
        WHERE fr.cliente_id = ${clienteId}::uuid AND fr.imovel_id IS NOT NULL AND fr.deleted_at IS NULL
        GROUP BY fr.cliente_id, fr.imovel_id
        HAVING COUNT(fr.id) >= 2
      )
      SELECT
        cf.cliente_id,
        cf.imovel_id,
        im.logradouro,
        im.numero,
        im.bairro,
        im.regiao_id,
        cf.total_focos_historico,
        cf.focos_reincidentes,
        cf.focos_ativos_atual,
        cf.ultimo_foco_em,
        ROUND(cf.focos_reincidentes::numeric / NULLIF(cf.total_focos_historico, 0) * 100, 1) AS indice_reincidencia_pct
      FROM cadeia_focos cf
      JOIN imoveis im ON im.id = cf.imovel_id AND im.deleted_at IS NULL
      ORDER BY cf.total_focos_historico DESC, cf.ultimo_foco_em DESC
    `)
  }
}
