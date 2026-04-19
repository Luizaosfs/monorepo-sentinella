import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Prisma } from '@prisma/client';
import { Request } from 'express';

import { PrismaService } from 'src/shared/modules/database/prisma/prisma.service';

export interface ListarComVinculosFilter {
  status?: string;
  tipoVinculo?: string;
  focoRiscoId?: string;
  limit?: number;
}

@Injectable()
export class ListarComVinculos {
  constructor(
    private prisma: PrismaService,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute(filters: ListarComVinculosFilter = {}) {
    const clienteId = this.req['tenantId'] as string;
    const limit = filters.limit ?? 100;

    const conditions: Prisma.Sql[] = [
      Prisma.sql`o.cliente_id = ${clienteId}::uuid`,
      Prisma.sql`o.deleted_at IS NULL`,
    ];

    if (filters.status) {
      conditions.push(Prisma.sql`o.status = ${filters.status}`);
    }
    if (filters.tipoVinculo) {
      conditions.push(Prisma.sql`o.tipo_vinculo = ${filters.tipoVinculo}`);
    }
    if (filters.focoRiscoId) {
      conditions.push(Prisma.sql`o.foco_risco_id = ${filters.focoRiscoId}::uuid`);
    }

    const where = Prisma.join(conditions, ' AND ');

    return this.prisma.client.$queryRaw(Prisma.sql`
      SELECT
        o.id,
        o.status,
        o.prioridade,
        o.tipo_vinculo,
        o.iniciado_em,
        o.concluido_em,
        o.observacao,
        o.created_at,
        jsonb_build_object(
          'id', u.id,
          'nome', u.nome,
          'email', u.email
        ) AS responsavel,
        jsonb_build_object(
          'id', fr.id,
          'status', fr.status,
          'suspeita_em', fr.suspeita_em
        ) AS foco_risco,
        jsonb_build_object(
          'id', r.id,
          'nome', r.nome
        ) AS regiao
      FROM operacoes o
      LEFT JOIN usuarios u ON o.responsavel_id = u.id
      LEFT JOIN focos_risco fr ON o.foco_risco_id = fr.id AND fr.deleted_at IS NULL
      LEFT JOIN regioes r ON o.regiao_id = r.id AND r.deleted_at IS NULL
      WHERE ${where}
      ORDER BY o.created_at DESC
      LIMIT ${limit}
    `);
  }
}
