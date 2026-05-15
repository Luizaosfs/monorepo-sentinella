import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

export interface ResolverTerritorioInput {
  clienteId: string;
  latitude: number | null | undefined;
  longitude: number | null | undefined;
}

export interface ResolverTerritorioResult {
  bairroId: string | null;
  bairroNome: string | null;
  quadraId: string | null;
  quadraCodigo: string | null;
}

/**
 * Resolve bairro e quadra de um ponto (lat/long) via PostGIS.
 *
 * Mesmo padrão de `PreencherBairroImoveis`: ST_Contains(area::geometry, ponto).
 * `bairros.area` e `bairros_quadras.area` são geometry(Polygon,4326) com índice GIST.
 *
 * Best-effort: sem coordenadas ou sem polígono cadastrado → null (não lança).
 */
@Injectable()
export class ResolverTerritorioPorCoordenada {
  private readonly logger = new Logger(ResolverTerritorioPorCoordenada.name);

  constructor(private prisma: PrismaService) {}

  async execute(
    input: ResolverTerritorioInput,
  ): Promise<ResolverTerritorioResult> {
    const { clienteId, latitude, longitude } = input;

    if (latitude == null || longitude == null) {
      return {
        bairroId: null,
        bairroNome: null,
        quadraId: null,
        quadraCodigo: null,
      };
    }

    const ponto = Prisma.sql`ST_SetSRID(ST_MakePoint(${longitude}::float8, ${latitude}::float8), 4326)`;

    const bairroRows = await this.prisma.client.$queryRaw<
      { id: string; nome: string }[]
    >(
      Prisma.sql`
        SELECT b.id, b.nome
          FROM bairros b
         WHERE b.cliente_id = ${clienteId}::uuid
           AND b.deleted_at IS NULL
           AND b.area       IS NOT NULL
           AND ST_Contains(b.area::geometry, ${ponto})
         LIMIT 1
      `,
    );

    const quadraRows = await this.prisma.client.$queryRaw<
      { id: string; codigo: string }[]
    >(
      Prisma.sql`
        SELECT q.id, q.codigo
          FROM bairros_quadras q
         WHERE q.cliente_id = ${clienteId}::uuid
           AND q.deleted_at IS NULL
           AND q.ativo       = true
           AND q.area        IS NOT NULL
           AND ST_Contains(q.area::geometry, ${ponto})
         LIMIT 1
      `,
    );

    const bairroId = bairroRows[0]?.id ?? null;
    const bairroNome = bairroRows[0]?.nome ?? null;
    const quadraId = quadraRows[0]?.id ?? null;
    const quadraCodigo = quadraRows[0]?.codigo ?? null;

    this.logger.debug(
      `[ResolverTerritorio] cliente=${clienteId} lat=${latitude} lng=${longitude} ` +
        `bairro=${bairroId ?? 'null'} quadra=${quadraId ?? 'null'}`,
    );

    return { bairroId, bairroNome, quadraId, quadraCodigo };
  }
}
