import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

@Injectable()
export class ListAtivasByCliente {
  constructor(private prisma: PrismaService) {}

  execute(clienteId: string) {
    return this.prisma.client.$queryRaw(Prisma.sql`
      WITH base AS (
        SELECT
          id,
          cliente_id,
          imovel_id,
          endereco_normalizado,
          COALESCE(imovel_id::text, endereco_normalizado) AS chave,
          score_prioridade,
          created_at
        FROM focos_risco
        WHERE cliente_id = ${clienteId}::uuid
          AND deleted_at IS NULL
          AND status NOT IN ('descartado')
          AND created_at >= NOW() - INTERVAL '30 days'
      ),
      grouped AS (
        SELECT
          chave,
          cliente_id,
          COUNT(*)::int                AS total_ocorrencias,
          MIN(created_at)              AS primeira_ocorrencia_em,
          MAX(created_at)              AS ultima_ocorrencia_em,
          MAX(score_prioridade)        AS ultima_prioridade
        FROM base
        GROUP BY chave, cliente_id
        HAVING COUNT(*) >= 2
      )
      SELECT
        g.chave                AS id,
        g.cliente_id,
        g.chave                AS endereco_ref,
        g.total_ocorrencias,
        (SELECT b.id FROM base b WHERE b.chave = g.chave ORDER BY b.created_at ASC  LIMIT 1) AS primeira_ocorrencia_id,
        (SELECT b.id FROM base b WHERE b.chave = g.chave ORDER BY b.created_at DESC LIMIT 1) AS ultima_ocorrencia_id,
        g.primeira_ocorrencia_em,
        g.ultima_ocorrencia_em,
        g.ultima_prioridade
      FROM grouped g
      ORDER BY g.total_ocorrencias DESC
    `);
  }
}
