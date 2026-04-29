import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';
import { Request } from 'express';
import { getAccessScope, requireTenantId } from '@shared/security/access-scope.helpers';

import { FilterVistoriaConsolidadasInput } from '../dtos/filter-vistoria-consolidadas.input';

@Injectable()
export class ListVistoriasConsolidadas {
  constructor(
    private prisma: PrismaService,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute(filters: FilterVistoriaConsolidadasInput) {
    // MT-02: tenantId do guard sempre vence
    const clienteId = requireTenantId(getAccessScope(this.req));

    const conditions: Prisma.Sql[] = [
      Prisma.sql`v.cliente_id = ${clienteId}::uuid`,
      Prisma.sql`v.deleted_at IS NULL`,
      Prisma.sql`v.prioridade_final IS NOT NULL`,
    ];

    if (filters.prioridade_final?.length) {
      conditions.push(
        Prisma.sql`v.prioridade_final = ANY(${filters.prioridade_final}::text[])`,
      );
    }

    if (filters.alerta_saude !== undefined) {
      conditions.push(
        Prisma.sql`v.alerta_saude = ${filters.alerta_saude}`,
      );
    }

    if (filters.risco_vetorial !== undefined) {
      conditions.push(
        Prisma.sql`v.risco_vetorial = ${filters.risco_vetorial}`,
      );
    }

    if (filters.consolidacao_incompleta !== undefined) {
      conditions.push(
        Prisma.sql`v.consolidacao_incompleta = ${filters.consolidacao_incompleta}`,
      );
    }

    const where = Prisma.join(conditions, ' AND ');
    const limit = filters.limit;

    const rows = await this.prisma.client.$queryRaw<Record<string, unknown>[]>(
      Prisma.sql`
        SELECT
          v.id,
          v.data_visita,
          v.status,
          v.acesso_realizado,
          v.prioridade_final,
          v.prioridade_motivo,
          v.dimensao_dominante,
          v.vulnerabilidade_domiciliar,
          v.alerta_saude,
          v.risco_socioambiental,
          v.risco_vetorial,
          v.consolidacao_incompleta,
          v.consolidacao_resumo,
          v.consolidado_em,
          jsonb_build_object(
            'id',        i.id,
            'logradouro', i.logradouro,
            'numero',    i.numero,
            'bairro',    i.bairro,
            'regiao_id', i.regiao_id
          ) AS imovel,
          jsonb_build_object(
            'id',   u.id,
            'nome', u.nome
          ) AS agente
        FROM vistorias v
        LEFT JOIN imoveis i ON i.id = v.imovel_id
        LEFT JOIN usuarios u ON u.id = v.agente_id
        WHERE ${where}
        ORDER BY v.consolidado_em DESC
        LIMIT ${limit}
      `,
    );

    return { vistorias: rows };
  }
}
