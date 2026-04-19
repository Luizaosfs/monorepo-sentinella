import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '@shared/modules/database/prisma/prisma.service'

@Injectable()
export class GetPilotoDespachosSupervisor {
  constructor(private prisma: PrismaService) {}

  execute(clienteId: string) {
    return this.prisma.client.$queryRaw(Prisma.sql`
      WITH primeiro_despacho AS (
        SELECT DISTINCT ON (frh.foco_risco_id)
          frh.foco_risco_id,
          frh.cliente_id,
          frh.alterado_por AS supervisor_id,
          frh.alterado_em AS despachado_em
        FROM foco_risco_historico frh
        WHERE frh.status_novo = 'aguarda_inspecao' AND frh.cliente_id = ${clienteId}::uuid
        ORDER BY frh.foco_risco_id, frh.alterado_em ASC
      )
      SELECT
        pd.cliente_id,
        pd.supervisor_id,
        u.nome AS supervisor_nome,
        COUNT(*) AS despachos_total,
        COUNT(*) FILTER (WHERE pd.despachado_em >= CURRENT_DATE) AS despachos_hoje,
        COUNT(*) FILTER (WHERE pd.despachado_em >= CURRENT_DATE - INTERVAL '7 days') AS despachos_7d,
        ROUND(AVG(EXTRACT(EPOCH FROM (pd.despachado_em - fr.suspeita_em)) / 3600.0)
          FILTER (WHERE fr.suspeita_em IS NOT NULL)::numeric, 1) AS tempo_medio_triagem_7d_horas
      FROM primeiro_despacho pd
      JOIN focos_risco fr ON fr.id = pd.foco_risco_id AND fr.deleted_at IS NULL
      LEFT JOIN usuarios u ON u.id = pd.supervisor_id
      GROUP BY pd.cliente_id, pd.supervisor_id, u.nome
      ORDER BY despachos_hoje DESC
    `)
  }
}
