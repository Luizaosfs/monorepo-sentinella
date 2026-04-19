import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '@shared/modules/database/prisma/prisma.service'

@Injectable()
export class GetRegionalUso {
  constructor(private prisma: PrismaService) {}

  execute(clienteId: string) {
    return this.prisma.client.$queryRaw(Prisma.sql`
      SELECT
        c.id AS cliente_id, c.nome AS municipio_nome, c.cidade, c.uf,
        COUNT(pe.id) FILTER (WHERE pe.created_at >= now() - INTERVAL '7 days') AS eventos_7d,
        COUNT(pe.id) FILTER (WHERE pe.tipo IN ('triagem_distribuicao_lote','triagem_distribuicao_individual') AND pe.created_at >= now() - INTERVAL '7 days') AS distribuicoes_7d,
        COUNT(pe.id) FILTER (WHERE pe.tipo = 'foco_inspecao_iniciada' AND pe.created_at >= now() - INTERVAL '7 days') AS inspecoes_iniciadas_7d,
        COUNT(pe.id) FILTER (WHERE pe.tipo = 'foco_resolvido' AND pe.created_at >= now() - INTERVAL '7 days') AS focos_resolvidos_7d,
        MAX(pe.created_at) AS ultimo_evento_em,
        now() AS calculado_em
      FROM clientes c
      LEFT JOIN piloto_eventos pe ON pe.cliente_id = c.id
      WHERE c.id = ${clienteId}::uuid AND c.ativo = true AND (c.deleted_at IS NULL OR c.deleted_at > now())
      GROUP BY c.id, c.nome, c.cidade, c.uf
    `)
  }
}
