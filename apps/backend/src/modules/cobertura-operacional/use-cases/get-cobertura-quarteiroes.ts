import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

import {
  CoberturaQuarteiraoDto,
  calcularPercentual,
  calcularStatus,
} from '../view-model/cobertura.vm';

type RawRow = { quarteirao: string; total_imoveis: number; visitados: number };

@Injectable()
export class GetCoberturaQuarteiroesSUc {
  constructor(private prisma: PrismaService) {}

  async execute(clienteId: string): Promise<CoberturaQuarteiraoDto[]> {
    const cicloAtivo = await this.prisma.client.ciclos.findFirst({
      where: { cliente_id: clienteId, status: 'ativo' },
      select: { id: true, numero: true },
    });
    if (!cicloAtivo) return [];

    const rows = await this.prisma.client.$queryRaw<RawRow[]>(Prisma.sql`
      SELECT
        q.codigo AS quarteirao,
        COUNT(DISTINCT i.id)::int AS total_imoveis,
        COUNT(DISTINCT v.imovel_id)::int AS visitados
      FROM bairros_distribuicao dq
      JOIN bairros_quadras q ON q.id = dq.quadra_id
      LEFT JOIN imoveis i
        ON i.quarteirao = q.codigo AND i.cliente_id = dq.cliente_id AND i.deleted_at IS NULL
      LEFT JOIN vistorias v
        ON v.imovel_id = i.id
        AND v.ciclo = ${cicloAtivo.numero}
        AND v.deleted_at IS NULL
        AND v.imovel_id IS NOT NULL
      WHERE dq.cliente_id = ${clienteId}::uuid AND dq.ciclo_id = ${cicloAtivo.id}::uuid
      GROUP BY q.codigo
      ORDER BY q.codigo
    `);

    return rows.map(r => {
      const total = Number(r.total_imoveis);
      const visitados = Number(r.visitados);
      return {
        quarteirao: r.quarteirao,
        totalImoveis: total,
        visitados,
        pendentes: Math.max(0, total - visitados),
        percentualCobertura: calcularPercentual(visitados, total),
        status: calcularStatus(visitados, total),
      };
    });
  }
}
