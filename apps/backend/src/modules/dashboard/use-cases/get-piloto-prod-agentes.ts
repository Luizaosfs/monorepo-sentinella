import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '@shared/modules/database/prisma/prisma.service'

@Injectable()
export class GetPilotoProdAgentes {
  constructor(private prisma: PrismaService) {}

  execute(clienteId: string) {
    return this.prisma.client.$queryRaw(Prisma.sql`
      SELECT
        fr.cliente_id,
        fr.responsavel_id AS agente_id,
        u.nome AS agente_nome,
        COUNT(*) FILTER (WHERE fr.status NOT IN ('resolvido','descartado')) AS atribuidos_ativos,
        COUNT(*) FILTER (WHERE fr.status = 'resolvido') AS resolvidos_total,
        COUNT(*) FILTER (WHERE fr.status = 'resolvido' AND fr.resolvido_em >= CURRENT_DATE) AS resolvidos_hoje,
        COUNT(*) FILTER (WHERE fr.status = 'resolvido' AND fr.resolvido_em >= CURRENT_DATE - INTERVAL '7 days') AS resolvidos_7d,
        ROUND(AVG(EXTRACT(EPOCH FROM (fr.inspecao_em - fr.suspeita_em)) / 3600.0)
          FILTER (WHERE fr.inspecao_em IS NOT NULL AND fr.suspeita_em IS NOT NULL)::numeric, 1) AS tempo_medio_suspeita_inspecao_horas
      FROM focos_risco fr
      LEFT JOIN usuarios u ON u.id = fr.responsavel_id
      WHERE fr.cliente_id = ${clienteId}::uuid AND fr.deleted_at IS NULL AND fr.responsavel_id IS NOT NULL
      GROUP BY fr.cliente_id, fr.responsavel_id, u.nome
      ORDER BY resolvidos_total DESC
    `)
  }
}
