import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '@shared/modules/database/prisma/prisma.service'

@Injectable()
export class GetRegionalSla {
  constructor(private prisma: PrismaService) {}

  execute(clienteId: string) {
    return this.prisma.client.$queryRaw(Prisma.sql`
      SELECT
        c.id AS cliente_id, c.nome AS municipio_nome, c.cidade, c.uf,
        COUNT(f.id) FILTER (WHERE f.status IN ('confirmado','em_tratamento')) AS total_ativos,
        COUNT(f.id) FILTER (WHERE f.status IN ('confirmado','em_tratamento') AND f.confirmado_em >= now() - INTERVAL '12 hours') AS sla_ok,
        COUNT(f.id) FILTER (WHERE f.status IN ('confirmado','em_tratamento') AND f.confirmado_em < now() - INTERVAL '12 hours' AND f.confirmado_em >= now() - INTERVAL '24 hours') AS sla_atencao,
        COUNT(f.id) FILTER (WHERE f.status IN ('confirmado','em_tratamento') AND f.confirmado_em < now() - INTERVAL '24 hours' AND f.confirmado_em >= now() - INTERVAL '72 hours') AS sla_critico,
        COUNT(f.id) FILTER (WHERE f.status IN ('confirmado','em_tratamento') AND f.confirmado_em < now() - INTERVAL '72 hours') AS sla_vencido,
        now() AS calculado_em
      FROM clientes c
      LEFT JOIN focos_risco f ON f.cliente_id = c.id AND f.deleted_at IS NULL
      WHERE c.id = ${clienteId}::uuid AND c.ativo = true AND (c.deleted_at IS NULL OR c.deleted_at > now())
      GROUP BY c.id, c.nome, c.cidade, c.uf
    `)
  }
}
