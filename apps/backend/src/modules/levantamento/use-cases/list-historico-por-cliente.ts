import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

@Injectable()
export class ListHistoricoPorCliente {
  constructor(private prisma: PrismaService) {}

  execute(clienteId: string) {
    return this.prisma.client.$queryRaw(Prisma.sql`
      SELECT
        li.id                  AS levantamento_item_id,
        li.levantamento_id,
        li.latitude,
        li.longitude,
        li.item,
        li.risco,
        li.prioridade,
        li.acao,
        li.endereco_curto,
        li.endereco_completo,
        li.data_hora           AS item_data_hora,
        li.created_at          AS item_created_at,
        li.cliente_id,
        lev.tipo_entrada       AS levantamento_tipo_entrada,
        op.id                  AS operacao_id,
        op.status              AS operacao_status,
        op.iniciado_em         AS operacao_iniciado_em,
        op.concluido_em        AS operacao_concluido_em,
        op.observacao          AS operacao_observacao,
        op.responsavel_id,
        u.nome                 AS responsavel_nome,
        u.email                AS responsavel_email
      FROM levantamento_itens li
      LEFT JOIN levantamentos lev ON lev.id = li.levantamento_id
      LEFT JOIN operacoes op
        ON op.item_levantamento_id = li.id
        AND op.deleted_at IS NULL
      LEFT JOIN usuarios u ON u.id = op.responsavel_id
      WHERE li.cliente_id = ${clienteId}::uuid
        AND li.deleted_at IS NULL
      ORDER BY li.data_hora DESC NULLS LAST
      LIMIT 1000
    `);
  }
}
