import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '@shared/modules/database/prisma/prisma.service'

@Injectable()
export class GetScoreBairro {
  constructor(private prisma: PrismaService) {}

  execute(clienteId: string) {
    return this.prisma.client.$queryRaw(Prisma.sql`
      SELECT
        ts.cliente_id,
        im.bairro,
        im.regiao_id,
        COUNT(*) AS imoveis_com_score,
        ROUND(AVG(ts.score), 1) AS score_medio,
        MAX(ts.score) AS score_maximo,
        PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY ts.score::double precision) AS score_p75,
        COUNT(*) FILTER (WHERE ts.classificacao = ANY(ARRAY['muito_alto','critico'])) AS imoveis_criticos,
        COUNT(*) FILTER (WHERE ts.classificacao = 'alto') AS imoveis_alto,
        MAX(ts.calculado_em) AS ultimo_calculo
      FROM territorio_score ts
      JOIN imoveis im ON im.id = ts.imovel_id AND im.deleted_at IS NULL
      WHERE ts.cliente_id = ${clienteId}::uuid
      GROUP BY ts.cliente_id, im.bairro, im.regiao_id
      ORDER BY score_medio DESC
    `)
  }
}
