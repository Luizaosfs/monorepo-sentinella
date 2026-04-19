import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '@shared/modules/database/prisma/prisma.service'

@Injectable()
export class GetRegionalKpi {
  constructor(private prisma: PrismaService) {}

  execute(clienteId: string) {
    return this.prisma.client.$queryRaw(Prisma.sql`
      SELECT
        c.id AS cliente_id, c.nome AS municipio_nome, c.cidade, c.uf,
        COUNT(f.id) AS total_focos,
        COUNT(f.id) FILTER (WHERE f.status = 'suspeita') AS focos_suspeita,
        COUNT(f.id) FILTER (WHERE f.status = 'em_triagem') AS focos_em_triagem,
        COUNT(f.id) FILTER (WHERE f.status = 'aguarda_inspecao') AS focos_aguarda_inspecao,
        COUNT(f.id) FILTER (WHERE f.status IN ('em_inspecao','confirmado','em_tratamento')) AS focos_ativos,
        COUNT(f.id) FILTER (WHERE f.status = 'confirmado') AS focos_confirmados,
        COUNT(f.id) FILTER (WHERE f.status = 'em_tratamento') AS focos_em_tratamento,
        COUNT(f.id) FILTER (WHERE f.status = 'resolvido') AS focos_resolvidos,
        COUNT(f.id) FILTER (WHERE f.status = 'descartado') AS focos_descartados,
        ROUND(CASE
          WHEN COUNT(f.id) FILTER (WHERE f.status NOT IN ('suspeita','descartado')) > 0
          THEN COUNT(f.id) FILTER (WHERE f.status = 'resolvido')::numeric
             / COUNT(f.id) FILTER (WHERE f.status NOT IN ('suspeita','descartado'))::numeric * 100
          ELSE 0
        END, 1) AS taxa_resolucao_pct,
        ROUND(AVG(EXTRACT(EPOCH FROM (f.resolvido_em - f.confirmado_em)) / 3600.0)
          FILTER (WHERE f.resolvido_em IS NOT NULL AND f.confirmado_em IS NOT NULL)::numeric, 1) AS tempo_medio_resolucao_horas,
        COUNT(f.id) FILTER (
          WHERE f.status IN ('confirmado','em_tratamento') AND f.confirmado_em IS NOT NULL AND f.confirmado_em < now() - INTERVAL '72 hours'
        ) AS sla_vencido_count,
        now() AS calculado_em
      FROM clientes c
      LEFT JOIN focos_risco f ON f.cliente_id = c.id AND f.deleted_at IS NULL
      WHERE c.id = ${clienteId}::uuid AND c.ativo = true AND (c.deleted_at IS NULL OR c.deleted_at > now())
      GROUP BY c.id, c.nome, c.cidade, c.uf
    `)
  }

  executeAll() {
    return this.prisma.client.$queryRaw(Prisma.sql`
      SELECT
        c.id AS cliente_id, c.nome AS municipio_nome, c.cidade, c.uf,
        COUNT(f.id) AS total_focos,
        COUNT(f.id) FILTER (WHERE f.status NOT IN ('suspeita','descartado','resolvido')) AS focos_ativos,
        COUNT(f.id) FILTER (WHERE f.status = 'resolvido') AS focos_resolvidos,
        now() AS calculado_em
      FROM clientes c
      LEFT JOIN focos_risco f ON f.cliente_id = c.id AND f.deleted_at IS NULL
      WHERE c.ativo = true AND (c.deleted_at IS NULL OR c.deleted_at > now())
      GROUP BY c.id, c.nome, c.cidade, c.uf
      ORDER BY focos_ativos DESC NULLS LAST
    `)
  }
}
