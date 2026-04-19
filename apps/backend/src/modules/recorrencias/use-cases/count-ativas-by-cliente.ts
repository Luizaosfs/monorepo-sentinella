import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

@Injectable()
export class CountAtivasByCliente {
  constructor(private prisma: PrismaService) {}

  async execute(clienteId: string): Promise<number> {
    const rows = await this.prisma.client.$queryRaw<{ total: number }[]>(Prisma.sql`
      SELECT COUNT(*)::int AS total
      FROM (
        SELECT COALESCE(imovel_id::text, endereco_normalizado) AS chave
        FROM focos_risco
        WHERE cliente_id = ${clienteId}::uuid
          AND deleted_at IS NULL
          AND status NOT IN ('descartado')
          AND created_at >= NOW() - INTERVAL '30 days'
        GROUP BY chave
        HAVING COUNT(*) >= 2
      ) sub
    `);
    return rows[0]?.total ?? 0;
  }
}
