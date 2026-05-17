import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

export interface ResolverTerritorioInput {
  clienteId: string;
  latitude: number | null | undefined;
  longitude: number | null | undefined;
  /**
   * Escalonamento de "snap" do quarteirão quando o ST_Contains exato falha.
   * Lista ordenada de raios em metros — tenta o mais próximo dentro de cada
   * raio, na ordem. Default undefined = estrito (sem snap). Usado pela denúncia
   * de cidadão: o geocode cai no eixo da rua e o polígono da quadra é o miolo
   * do bloco (recuado alguns metros), então um endereço correto fica ~5-15 m
   * fora. Casos notificados continuam estritos (não passam este campo).
   */
  quadraSnapMetros?: number[];
}

export interface ResolverTerritorioResult {
  bairroId: string | null;
  bairroNome: string | null;
  quadraId: string | null;
  quadraCodigo: string | null;
  /** true quando a quadra foi resolvida por proximidade (snap), não por ST_Contains. */
  quadraAproximada?: boolean;
}

/**
 * Resolve bairro e quadra de um ponto (lat/long) via PostGIS.
 *
 * Bairro: SEMPRE estrito (ST_Contains). Se o ponto cair fora dos polígonos de
 * bairro, retorna null — endereço impreciso não deve atribuir bairro errado.
 *
 * Quadra: ST_Contains primeiro; se `quadraSnapMetros` for informado e nada for
 * contido, tenta o quarteirão mais próximo dentro de cada raio, em ordem.
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
    const snaps = (input.quadraSnapMetros ?? []).filter((m) => m > 0);

    if (latitude == null || longitude == null) {
      return {
        bairroId: null,
        bairroNome: null,
        quadraId: null,
        quadraCodigo: null,
        quadraAproximada: false,
      };
    }

    const ponto = Prisma.sql`ST_SetSRID(ST_MakePoint(${longitude}::float8, ${latitude}::float8), 4326)`;
    const pontoGeog = Prisma.sql`${ponto}::geography`;

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

    let quadraRows = await this.prisma.client.$queryRaw<
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

    let quadraAproximada = false;
    if (quadraRows.length === 0 && snaps.length > 0) {
      for (const raio of snaps) {
        quadraRows = await this.prisma.client.$queryRaw<
          { id: string; codigo: string }[]
        >(
          Prisma.sql`
            SELECT q.id, q.codigo
              FROM bairros_quadras q
             WHERE q.cliente_id = ${clienteId}::uuid
               AND q.deleted_at IS NULL
               AND q.ativo       = true
               AND q.area        IS NOT NULL
               AND ST_DWithin(q.area::geography, ${pontoGeog}, ${raio})
             ORDER BY q.area::geography <-> ${pontoGeog}
             LIMIT 1
          `,
        );
        if (quadraRows.length > 0) {
          quadraAproximada = true;
          this.logger.debug(
            `[ResolverTerritorio] quadra resolvida por snap raio=${raio}m`,
          );
          break;
        }
      }
    }

    const bairroId = bairroRows[0]?.id ?? null;
    const bairroNome = bairroRows[0]?.nome ?? null;
    const quadraId = quadraRows[0]?.id ?? null;
    const quadraCodigo = quadraRows[0]?.codigo ?? null;

    this.logger.debug(
      `[ResolverTerritorio] cliente=${clienteId} lat=${latitude} lng=${longitude} ` +
        `bairro=${bairroId ?? 'null'} quadra=${quadraId ?? 'null'} ` +
        `aprox=${quadraAproximada}`,
    );

    return { bairroId, bairroNome, quadraId, quadraCodigo, quadraAproximada };
  }
}
