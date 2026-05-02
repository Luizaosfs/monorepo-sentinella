import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '@shared/modules/database/prisma/prisma.service'

@Injectable()
export class GetRegionalVulnerabilidade {
  constructor(private prisma: PrismaService) {}

  async execute(clienteIds: string[] | null) {
    if (clienteIds !== null && clienteIds.length === 0) {
      return []
    }

    const filtroCliente =
      clienteIds === null
        ? Prisma.empty
        : Prisma.sql`AND c.id = ANY(ARRAY[${Prisma.join(
            clienteIds.map((id) => Prisma.sql`${id}::uuid`),
          )}]::uuid[])`

    return this.prisma.client.$queryRaw(Prisma.sql`
      SELECT
        c.id              AS cliente_id,
        c.nome            AS municipio_nome,
        c.cidade,
        c.uf,

        COUNT(*)::int     AS total_vistorias,

        -- Vulnerabilidade domiciliar
        COUNT(*) FILTER (WHERE v.vulnerabilidade_domiciliar = 'baixa')::int   AS vulnerabilidade_baixa,
        COUNT(*) FILTER (WHERE v.vulnerabilidade_domiciliar = 'media')::int   AS vulnerabilidade_media,
        COUNT(*) FILTER (WHERE v.vulnerabilidade_domiciliar = 'alta')::int    AS vulnerabilidade_alta,
        COUNT(*) FILTER (WHERE v.vulnerabilidade_domiciliar = 'critica')::int AS vulnerabilidade_critica,

        -- Risco vetorial
        COUNT(*) FILTER (WHERE v.risco_vetorial = 'baixo')::int   AS risco_vetorial_baixo,
        COUNT(*) FILTER (WHERE v.risco_vetorial = 'medio')::int   AS risco_vetorial_medio,
        COUNT(*) FILTER (WHERE v.risco_vetorial = 'alto')::int    AS risco_vetorial_alto,
        COUNT(*) FILTER (WHERE v.risco_vetorial = 'critico')::int AS risco_vetorial_critico,

        -- Alerta saúde
        COUNT(*) FILTER (WHERE v.alerta_saude = 'urgente')::int   AS alerta_saude_urgente,

        -- Prioridade final consolidada
        COUNT(*) FILTER (WHERE v.prioridade_final = 'P1')::int AS prioridade_p1,
        COUNT(*) FILTER (WHERE v.prioridade_final = 'P2')::int AS prioridade_p2,
        COUNT(*) FILTER (WHERE v.prioridade_final = 'P3')::int AS prioridade_p3,

        now()             AS calculado_em

      FROM vistorias v
      JOIN clientes c ON c.id = v.cliente_id
      WHERE v.deleted_at IS NULL
        AND c.ativo = true
        AND (c.deleted_at IS NULL OR c.deleted_at > now())
        ${filtroCliente}
      GROUP BY c.id, c.nome, c.cidade, c.uf
      ORDER BY vulnerabilidade_critica DESC, risco_vetorial_critico DESC
    `)
  }
}
