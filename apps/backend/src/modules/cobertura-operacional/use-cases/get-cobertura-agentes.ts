import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

import {
  CoberturaAgenteDto,
  calcularPercentual,
} from '../view-model/cobertura.vm';

type RawRow = { agente_id: string; nome: string; total_imoveis: number; visitados: number };

@Injectable()
export class GetCoberturaAgentesUc {
  constructor(private prisma: PrismaService) {}

  async execute(clienteId: string): Promise<CoberturaAgenteDto[]> {
    const cicloAtivo = await this.prisma.client.ciclos.findFirst({
      where: { cliente_id: clienteId, status: 'ativo' },
      select: { id: true, numero: true },
    });
    if (!cicloAtivo) return [];

    const rows = await this.prisma.client.$queryRaw<RawRow[]>(Prisma.sql`
      SELECT
        dq.agente_id,
        u.nome,
        COUNT(DISTINCT i.id)::int AS total_imoveis,
        COUNT(DISTINCT v.imovel_id)::int AS visitados
      FROM bairros_distribuicao dq
      JOIN bairros_quadras q ON q.id = dq.quadra_id
      INNER JOIN usuarios u ON u.id = dq.agente_id
      LEFT JOIN imoveis i
        ON i.quarteirao = q.codigo AND i.cliente_id = dq.cliente_id AND i.deleted_at IS NULL
      LEFT JOIN vistorias v
        ON v.imovel_id = i.id
        AND v.ciclo = ${cicloAtivo.numero}
        AND v.deleted_at IS NULL
        AND v.imovel_id IS NOT NULL
      WHERE dq.cliente_id = ${clienteId}::uuid AND dq.ciclo_id = ${cicloAtivo.id}::uuid
      GROUP BY dq.agente_id, u.nome
      ORDER BY visitados DESC, u.nome
    `);

    return rows.map(r => {
      const total = Number(r.total_imoveis);
      const visitados = Number(r.visitados);
      return {
        agenteId: r.agente_id,
        nome: r.nome,
        totalImoveis: total,
        visitados,
        pendentes: Math.max(0, total - visitados),
        percentualCobertura: calcularPercentual(visitados, total),
      };
    });
  }
}
