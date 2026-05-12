import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

@Injectable()
export class PreencherBairroImoveis {
  private readonly logger = new Logger(PreencherBairroImoveis.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Backfill de bairro_id em imóveis com o campo nulo.
   *
   * Passo 1 — PostGIS: ST_Contains(bairros.area, imoveis.geo) para imóveis com coordenadas.
   * Passo 2 — Texto:   ILIKE entre imoveis.bairro e bairros.nome para os restantes.
   *
   * Idempotente: re-rodar não altera imóveis que já têm bairro_id.
   */
  async execute(clienteId: string): Promise<{ postgis: number; texto: number; total: number }> {
    const postgisResult = await this.prisma.client.$executeRaw(Prisma.sql`
      UPDATE imoveis i
      SET    bairro_id = b.id
      FROM   bairros b
      WHERE  i.bairro_id  IS NULL
        AND  i.deleted_at IS NULL
        AND  b.deleted_at IS NULL
        AND  i.cliente_id = ${clienteId}::uuid
        AND  b.cliente_id = ${clienteId}::uuid
        AND  i.geo        IS NOT NULL
        AND  b.area       IS NOT NULL
        AND  ST_Contains(b.area::geometry, i.geo::geometry)
    `);

    const textoResult = await this.prisma.client.$executeRaw(Prisma.sql`
      UPDATE imoveis i
      SET    bairro_id = b.id
      FROM   bairros b
      WHERE  i.bairro_id  IS NULL
        AND  i.deleted_at IS NULL
        AND  b.deleted_at IS NULL
        AND  i.cliente_id = ${clienteId}::uuid
        AND  b.cliente_id = ${clienteId}::uuid
        AND  i.bairro     IS NOT NULL
        AND  i.bairro     ILIKE b.nome
    `);

    const total = postgisResult + textoResult;
    this.logger.log(
      `[PreencherBairroImoveis] clienteId=${clienteId} postgis=${postgisResult} texto=${textoResult} total=${total}`,
    );

    return { postgis: postgisResult, texto: textoResult, total };
  }
}
