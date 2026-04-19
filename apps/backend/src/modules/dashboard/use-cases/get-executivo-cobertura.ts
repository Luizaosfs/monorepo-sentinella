import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '@shared/modules/database/prisma/prisma.service'

@Injectable()
export class GetExecutivoCobertura {
  constructor(private prisma: PrismaService) {}

  execute(clienteId: string) {
    return this.prisma.client.$queryRaw(Prisma.sql`
      SELECT
        im.cliente_id,
        im.bairro,
        COUNT(DISTINCT im.id) AS total_imoveis,
        COUNT(DISTINCT v.imovel_id) FILTER (WHERE v.acesso_realizado = true AND v.created_at >= CURRENT_DATE - INTERVAL '30 days') AS imoveis_visitados_30d,
        ROUND(
          COUNT(DISTINCT v.imovel_id) FILTER (WHERE v.acesso_realizado = true AND v.created_at >= CURRENT_DATE - INTERVAL '30 days') * 100.0
          / NULLIF(COUNT(DISTINCT im.id), 0), 1
        ) AS cobertura_pct,
        ROUND(AVG(ts.score)::numeric, 1) AS score_medio_bairro,
        COUNT(DISTINCT fr.id) FILTER (WHERE fr.status NOT IN ('resolvido','descartado')) AS focos_ativos,
        COUNT(DISTINCT ts2.imovel_id) FILTER (WHERE ts2.classificacao IN ('critico','muito_alto')) AS imoveis_criticos
      FROM imoveis im
      LEFT JOIN vistorias v ON v.imovel_id = im.id AND v.deleted_at IS NULL
      LEFT JOIN territorio_score ts ON ts.imovel_id = im.id AND ts.cliente_id = im.cliente_id
      LEFT JOIN focos_risco fr ON fr.imovel_id = im.id AND fr.deleted_at IS NULL
      LEFT JOIN territorio_score ts2 ON ts2.imovel_id = im.id AND ts2.cliente_id = im.cliente_id
      WHERE im.cliente_id = ${clienteId}::uuid AND im.deleted_at IS NULL
      GROUP BY im.cliente_id, im.bairro
      ORDER BY focos_ativos DESC, score_medio_bairro DESC NULLS LAST
    `)
  }
}
