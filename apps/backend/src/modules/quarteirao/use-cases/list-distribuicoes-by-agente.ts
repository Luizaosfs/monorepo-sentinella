import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

export type DistribuicaoAgenteItem = {
  quadraId: string;
  codigo: string;
  bairroId: string | null;
};

@Injectable()
export class ListDistribuicoesByAgente {
  constructor(private prisma: PrismaService) {}

  async execute(clienteId: string, agenteId: string, cicloId: string): Promise<DistribuicaoAgenteItem[]> {
    const rows = await this.prisma.client.$queryRaw<{ quadra_id: string; codigo: string; bairro_id: string | null }[]>(Prisma.sql`
      SELECT bq.id AS quadra_id, bq.codigo, bq.bairro_id
      FROM bairros_distribuicao bd
      JOIN bairros_quadras bq ON bq.id = bd.quadra_id
      WHERE bd.cliente_id = ${clienteId}::uuid
        AND bd.agente_id  = ${agenteId}::uuid
        AND bd.ciclo_id   = ${cicloId}::uuid
      ORDER BY bq.codigo
    `);
    return rows.map(r => ({ quadraId: r.quadra_id, codigo: r.codigo, bairroId: r.bairro_id }));
  }
}
