import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

@Injectable()
export class CanalCidadaoStats {
  constructor(private prisma: PrismaService) {}

  async execute(clienteId: string) {
    const rows = await this.prisma.client.$queryRaw<
      {
        total: number;
        ultimas_24h: number;
        ultimos_7d: number;
        ultimos_30d: number;
        com_foco_vinculado: number;
        resolvidos: number;
        em_aberto: number;
      }[]
    >(Prisma.sql`
      SELECT
        COUNT(*)::int                                                               AS total,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours')::int     AS ultimas_24h,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::int       AS ultimos_7d,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days')::int      AS ultimos_30d,
        COUNT(*) FILTER (WHERE status != 'suspeita' AND deleted_at IS NULL)::int   AS com_foco_vinculado,
        COUNT(*) FILTER (WHERE status = 'resolvido')::int                          AS resolvidos,
        COUNT(*) FILTER (WHERE status NOT IN ('resolvido','descartado') AND deleted_at IS NULL)::int AS em_aberto
      FROM focos_risco
      WHERE cliente_id = ${clienteId}::uuid
        AND origem = 'canal_cidadao'
        AND deleted_at IS NULL
    `);
    return rows[0] ?? null;
  }
}
