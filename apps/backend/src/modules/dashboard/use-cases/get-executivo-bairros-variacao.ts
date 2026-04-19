import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '@shared/modules/database/prisma/prisma.service'

@Injectable()
export class GetExecutivoBairrosVariacao {
  constructor(private prisma: PrismaService) {}

  execute(clienteId: string) {
    return this.prisma.client.$queryRaw(Prisma.sql`
      WITH base AS (
        SELECT im.bairro, im.id AS imovel_id
        FROM imoveis im
        WHERE im.cliente_id = ${clienteId}::uuid AND im.deleted_at IS NULL
      )
      SELECT
        ${clienteId}::uuid AS cliente_id,
        b.bairro,
        ROUND(AVG(ts.score)::numeric, 1) AS score_atual,
        COUNT(DISTINCT fr7.id) AS focos_novos_7d,
        COUNT(DISTINCT fr30.id) AS focos_novos_30d,
        COUNT(DISTINCT cn.id) AS casos_30d,
        COUNT(DISTINCT v.id) AS vistorias_30d,
        ROUND((COUNT(DISTINCT fr7.id) - COUNT(DISTINCT fr30.id) / 4.0)::numeric, 1) AS variacao_focos,
        CASE
          WHEN ROUND((COUNT(DISTINCT fr7.id) - COUNT(DISTINCT fr30.id) / 4.0)::numeric, 1) > 2 THEN 'piorando'
          WHEN ROUND((COUNT(DISTINCT fr7.id) - COUNT(DISTINCT fr30.id) / 4.0)::numeric, 1) < -2 THEN 'melhorando'
          ELSE 'estavel'
        END AS classificacao_tendencia
      FROM base b
      LEFT JOIN territorio_score ts ON ts.imovel_id = b.imovel_id AND ts.cliente_id = ${clienteId}::uuid
      LEFT JOIN focos_risco fr7 ON fr7.imovel_id = b.imovel_id AND fr7.deleted_at IS NULL AND fr7.created_at >= CURRENT_DATE - INTERVAL '7 days'
      LEFT JOIN focos_risco fr30 ON fr30.imovel_id = b.imovel_id AND fr30.deleted_at IS NULL AND fr30.created_at >= CURRENT_DATE - INTERVAL '30 days'
      LEFT JOIN casos_notificados cn ON cn.cliente_id = ${clienteId}::uuid AND cn.bairro = b.bairro AND cn.deleted_at IS NULL AND cn.created_at >= CURRENT_DATE - INTERVAL '30 days'
      LEFT JOIN vistorias v ON v.imovel_id = b.imovel_id AND v.deleted_at IS NULL AND v.acesso_realizado = true AND v.created_at >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY b.bairro
      ORDER BY score_atual DESC NULLS LAST
    `)
  }
}
