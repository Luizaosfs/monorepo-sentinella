import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '@shared/modules/database/prisma/prisma.service'

@Injectable()
export class GetAnaliticoRiscoTerritorial {
  constructor(private prisma: PrismaService) {}

  execute(clienteId: string) {
    return this.prisma.client.$queryRaw(Prisma.sql`
      SELECT
        v.cliente_id,
        COALESCE(im.bairro, r.nome, '(sem bairro)')                                                    AS bairro,
        im.regiao_id,
        COUNT(*)::int                                                                                   AS total_vistorias,
        COUNT(*) FILTER (WHERE v.prioridade_final = ANY(ARRAY['P1','P2']))::int                        AS criticos_count,
        COUNT(*) FILTER (WHERE v.risco_vetorial IN ('alto','critico'))::int                            AS risco_vetorial_alto,
        COUNT(*) FILTER (WHERE v.vulnerabilidade_domiciliar IN ('alta','critica'))::int                AS vulnerabilidade_alta,
        COUNT(*) FILTER (WHERE v.alerta_saude IS NOT NULL AND v.alerta_saude <> 'nenhum')::int         AS alertas_saude,
        COUNT(*) FILTER (WHERE v.alerta_saude = 'urgente')::int                                        AS alertas_urgentes,
        COUNT(*) FILTER (WHERE v.risco_socioambiental = 'alto')::int                                   AS risco_socio_alto,
        COUNT(*) FILTER (WHERE v.acesso_realizado = false)::int                                        AS sem_acesso_total,
        ROUND(
          COUNT(*) FILTER (WHERE v.prioridade_final = ANY(ARRAY['P1','P2']))::numeric
          / NULLIF(COUNT(*), 0) * 100, 1
        )::float                                                                                        AS pct_criticos
      FROM vistorias v
      JOIN imoveis im ON im.id = v.imovel_id AND im.deleted_at IS NULL
      LEFT JOIN regioes r ON r.id = im.regiao_id AND r.deleted_at IS NULL
      WHERE v.cliente_id = ${clienteId}::uuid AND v.deleted_at IS NULL
      GROUP BY v.cliente_id, im.bairro, r.nome, im.regiao_id
      ORDER BY total_vistorias DESC
    `)
  }
}
