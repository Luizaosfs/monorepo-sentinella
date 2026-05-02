import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '@shared/modules/database/prisma/prisma.service'

@Injectable()
export class GetRegionalResumo {
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
        c.id                AS cliente_id,
        c.nome              AS municipio_nome,
        c.cidade,
        c.uf,

        -- Focos totais e por status
        (SELECT COUNT(*)::int FROM focos_risco f
          WHERE f.cliente_id = c.id AND f.deleted_at IS NULL)
          AS total_focos,
        (SELECT COUNT(*)::int FROM focos_risco f
          WHERE f.cliente_id = c.id AND f.deleted_at IS NULL
            AND f.status NOT IN ('suspeita','descartado','resolvido'))
          AS focos_ativos,
        (SELECT COUNT(*)::int FROM focos_risco f
          WHERE f.cliente_id = c.id AND f.deleted_at IS NULL
            AND f.status = 'resolvido')
          AS focos_resolvidos,
        (SELECT COUNT(*)::int FROM focos_risco f
          WHERE f.cliente_id = c.id AND f.deleted_at IS NULL
            AND f.status = 'descartado')
          AS focos_descartados,

        -- Taxa de resolução
        ROUND(CASE
          WHEN (SELECT COUNT(*) FROM focos_risco f
                WHERE f.cliente_id = c.id AND f.deleted_at IS NULL
                  AND f.status NOT IN ('suspeita','descartado')) > 0
          THEN (SELECT COUNT(*) FROM focos_risco f
                WHERE f.cliente_id = c.id AND f.deleted_at IS NULL
                  AND f.status = 'resolvido')::numeric
             / (SELECT COUNT(*) FROM focos_risco f
                WHERE f.cliente_id = c.id AND f.deleted_at IS NULL
                  AND f.status NOT IN ('suspeita','descartado'))::numeric * 100
          ELSE 0
        END, 1)::float8
          AS taxa_resolucao_pct,

        -- SLA vencido (>72h desde confirmação, ainda ativo)
        (SELECT COUNT(*)::int FROM focos_risco f
          WHERE f.cliente_id = c.id AND f.deleted_at IS NULL
            AND f.status IN ('confirmado','em_tratamento')
            AND f.confirmado_em IS NOT NULL
            AND f.confirmado_em < now() - INTERVAL '72 hours')
          AS sla_vencido_count,

        -- Vistorias
        (SELECT COUNT(*)::int FROM vistorias v
          WHERE v.cliente_id = c.id AND v.deleted_at IS NULL)
          AS total_vistorias,
        (SELECT COUNT(*)::int FROM vistorias v
          WHERE v.cliente_id = c.id AND v.deleted_at IS NULL
            AND v.acesso_realizado = true)
          AS vistorias_visitadas,

        -- Vulnerabilidade domiciliar (campo de consolidação)
        (SELECT COUNT(*)::int FROM vistorias v
          WHERE v.cliente_id = c.id AND v.deleted_at IS NULL
            AND v.vulnerabilidade_domiciliar = 'alta')
          AS vulnerabilidade_alta_count,
        (SELECT COUNT(*)::int FROM vistorias v
          WHERE v.cliente_id = c.id AND v.deleted_at IS NULL
            AND v.vulnerabilidade_domiciliar = 'critica')
          AS vulnerabilidade_critica_count,

        -- Risco vetorial (campo de consolidação)
        (SELECT COUNT(*)::int FROM vistorias v
          WHERE v.cliente_id = c.id AND v.deleted_at IS NULL
            AND v.risco_vetorial = 'alto')
          AS risco_vetorial_alto_count,
        (SELECT COUNT(*)::int FROM vistorias v
          WHERE v.cliente_id = c.id AND v.deleted_at IS NULL
            AND v.risco_vetorial = 'critico')
          AS risco_vetorial_critico_count,

        -- Alerta saúde urgente (campo de consolidação)
        (SELECT COUNT(*)::int FROM vistorias v
          WHERE v.cliente_id = c.id AND v.deleted_at IS NULL
            AND v.alerta_saude = 'urgente')
          AS alerta_saude_urgente_count,

        -- Focos ativos por prioridade
        (SELECT COUNT(*)::int FROM focos_risco f
          WHERE f.cliente_id = c.id AND f.deleted_at IS NULL
            AND f.prioridade = 'P1'
            AND f.status NOT IN ('resolvido','descartado'))
          AS prioridade_p1_count,
        (SELECT COUNT(*)::int FROM focos_risco f
          WHERE f.cliente_id = c.id AND f.deleted_at IS NULL
            AND f.prioridade = 'P2'
            AND f.status NOT IN ('resolvido','descartado'))
          AS prioridade_p2_count,

        now()               AS calculado_em

      FROM clientes c
      WHERE c.ativo = true AND (c.deleted_at IS NULL OR c.deleted_at > now())
        ${filtroCliente}
      ORDER BY focos_ativos DESC NULLS LAST
    `)
  }
}
