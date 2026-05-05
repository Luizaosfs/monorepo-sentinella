import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '@shared/modules/database/prisma/prisma.service'

@Injectable()
export class GetAnaliticoImoveisCriticos {
  constructor(private prisma: PrismaService) {}

  execute(clienteId: string, bairroFilter?: string, prioridadeFilter?: string) {
    const bairroClause = bairroFilter
      ? Prisma.sql`AND COALESCE(im.bairro, '(sem bairro)') = ${bairroFilter}`
      : Prisma.sql``;
    const prioridades = prioridadeFilter ? [prioridadeFilter] : ['P1', 'P2'];
    return this.prisma.client.$queryRaw(Prisma.sql`
      SELECT
        v.cliente_id,
        v.imovel_id,
        im.logradouro,
        im.numero,
        im.complemento,
        COALESCE(im.bairro, '(sem bairro)') AS bairro,
        im.regiao_id,
        v.id AS vistoria_id,
        v.data_visita,
        v.prioridade_final,
        v.prioridade_motivo,
        v.risco_vetorial,
        v.vulnerabilidade_domiciliar,
        v.risco_socioambiental,
        v.alerta_saude,
        v.resultado_operacional,
        (CASE WHEN v.risco_vetorial IN ('alto','critico') THEN 1 ELSE 0 END
         + CASE WHEN v.risco_socioambiental = 'alto' THEN 1 ELSE 0 END
         + CASE WHEN v.alerta_saude IS NOT NULL THEN 1 ELSE 0 END
        )::int AS dimensoes_criticas_count
      FROM vistorias v
      JOIN imoveis im ON im.id = v.imovel_id AND im.deleted_at IS NULL
      WHERE v.cliente_id = ${clienteId}::uuid AND v.deleted_at IS NULL
        AND v.prioridade_final = ANY(${prioridades})
      ${bairroClause}
      ORDER BY v.data_visita DESC
    `)
  }
}
