import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '@shared/modules/database/prisma/prisma.service'

@Injectable()
export class GetPilotoFunilHoje {
  constructor(private prisma: PrismaService) {}

  execute(clienteId: string) {
    return this.prisma.client.$queryRaw(Prisma.sql`
      WITH primeiro_despacho AS (
        SELECT DISTINCT ON (foco_risco_historico.foco_risco_id)
          foco_risco_historico.foco_risco_id,
          foco_risco_historico.alterado_por AS supervisor_id,
          foco_risco_historico.alterado_em AS despachado_em
        FROM foco_risco_historico
        WHERE foco_risco_historico.status_novo = 'aguarda_inspecao'
        ORDER BY foco_risco_historico.foco_risco_id, foco_risco_historico.alterado_em ASC
      )
      SELECT
        fr.cliente_id,
        COUNT(*) FILTER (WHERE fr.suspeita_em >= CURRENT_DATE) AS entradas_hoje,
        COUNT(*) FILTER (WHERE fr.status = 'em_triagem') AS em_triagem,
        COUNT(*) FILTER (WHERE fr.status = 'aguarda_inspecao') AS aguardando_inspecao,
        COUNT(*) FILTER (WHERE fr.status = 'em_inspecao') AS em_inspecao,
        COUNT(*) FILTER (WHERE fr.status = 'confirmado') AS confirmados,
        COUNT(*) FILTER (WHERE fr.status = 'em_tratamento') AS em_tratamento,
        COUNT(*) FILTER (WHERE fr.status = 'resolvido' AND fr.resolvido_em >= CURRENT_DATE) AS resolvidos_hoje,
        COUNT(*) FILTER (WHERE fr.status = 'descartado' AND fr.updated_at >= CURRENT_DATE) AS descartados_hoje,
        COUNT(*) FILTER (WHERE fr.origem_tipo = 'drone' AND fr.suspeita_em >= CURRENT_DATE) AS entradas_por_origem_hoje,
        COUNT(*) FILTER (WHERE fr.origem_tipo = 'manual' AND fr.suspeita_em >= CURRENT_DATE) AS entradas_manual_hoje,
        COUNT(*) FILTER (WHERE fr.origem_tipo = 'cidadao' AND fr.suspeita_em >= CURRENT_DATE) AS entradas_cidadao_hoje,
        COUNT(*) FILTER (WHERE fr.origem_tipo = 'pluvio' AND fr.suspeita_em >= CURRENT_DATE) AS entradas_pluvio_hoje
      FROM focos_risco fr
      LEFT JOIN primeiro_despacho pd ON pd.foco_risco_id = fr.id
      WHERE fr.cliente_id = ${clienteId}::uuid AND fr.deleted_at IS NULL
      GROUP BY fr.cliente_id
    `)
  }
}
