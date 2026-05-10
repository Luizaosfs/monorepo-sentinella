import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

@Injectable()
export class ListDistribuicoesByAgente {
  constructor(private prisma: PrismaService) {}

  async execute(clienteId: string, agenteId: string, cicloId: string): Promise<string[]> {
    const rows = await this.prisma.client.$queryRaw<{ codigo: string }[]>(Prisma.sql`
      SELECT bq.codigo
      FROM bairros_distribuicao bd
      JOIN bairros_quadras bq ON bq.id = bd.quadra_id
      WHERE bd.cliente_id = ${clienteId}::uuid
        AND bd.agente_id  = ${agenteId}::uuid
        AND bd.ciclo_id   = ${cicloId}::uuid
      ORDER BY bq.codigo
    `);
    return rows.map(r => r.codigo);
  }
}
