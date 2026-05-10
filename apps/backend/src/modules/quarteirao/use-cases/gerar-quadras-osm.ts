import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as turf from '@turf/turf';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';
import type { GerarQuadrasOSMInput } from '../dtos/gerar-quadras-osm.body';
import { QuarteiraoException } from '../errors/quarteirao.exception';

const OVERPASS_URLS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

const HIGHWAY_WIDTH: Record<string, number> = {
  motorway: 25, trunk: 22, primary: 18, secondary: 15, tertiary: 12,
  residential: 10, unclassified: 10, living_street: 8,
  service: 6, pedestrian: 5, road: 10,
};
const DEFAULT_WIDTH = 8;
const MIN_AREA_DEFAULT = 200;
const OVERPASS_TIMEOUT_MS = 55_000;

type Coord = [number, number];
type RingCoords = Coord[][];
type GeoPolygon = { type: 'Polygon'; coordinates: RingCoords };
type GeoMultiPolygon = { type: 'MultiPolygon'; coordinates: RingCoords[] };
type AnyFeature = { type: 'Feature'; geometry: GeoPolygon | GeoMultiPolygon; properties: Record<string, unknown> | null };

type OsmWay = {
  type: 'way';
  tags?: Record<string, string>;
  geometry?: Array<{ lat: number; lon: number }>;
};

@Injectable()
export class GerarQuadrasOSM {
  private readonly logger = new Logger(GerarQuadrasOSM.name);

  constructor(private prisma: PrismaService) {}

  async execute(clienteId: string, input: GerarQuadrasOSMInput) {
    // 1. Valida que a região pertence ao cliente
    const regioes = await this.prisma.client.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT id::text FROM bairros
      WHERE id         = ${input.bairroId}::uuid
        AND cliente_id = ${clienteId}::uuid
        AND deleted_at IS NULL
    `);
    if (regioes.length === 0) throw QuarteiraoException.forbiddenTenant();

    // 2. Calcular bbox [s, w, n, e] a partir do polígono de entrada
    const areaPoly = turf.polygon(input.geojson.coordinates as Coord[][]);
    const [minLon, minLat, maxLon, maxLat] = turf.bbox(areaPoly);
    const bbox = [minLat, minLon, maxLat, maxLon];

    // 3. Buscar malha viária via Overpass
    const highways = await this.fetchHighways(bbox);
    this.logger.log(`GerarQuadrasOSM: ${highways.length} vias encontradas no bbox`);

    // 4. Algoritmo buffer-and-subtract
    const areaMinima = input.areaMinima ?? MIN_AREA_DEFAULT;
    const candidatos = this.bufferAndSubtract(areaPoly as AnyFeature, highways, areaMinima);

    // 5. Gerar códigos sugeridos com prefixo
    const prefixo = (input.prefixo ?? 'Q').trim().toUpperCase();
    const result = candidatos.map((poly, i) => ({
      codigo: `${prefixo}${String(i + 1).padStart(3, '0')}`,
      areaM2: Math.round(turf.area(poly as Parameters<typeof turf.area>[0])),
      geojson: (poly as AnyFeature).geometry as GeoPolygon,
    }));

    return {
      candidatos: result,
      totalViasEncontradas: highways.length,
    };
  }

  private async fetchHighways(bbox: number[]): Promise<OsmWay[]> {
    const types = Object.keys(HIGHWAY_WIDTH);
    const filters = types.map(h => `way["highway"="${h}"](${bbox.join(',')});`).join('\n  ');
    const query = `[out:json][timeout:50];\n(\n  ${filters}\n);\nout body geom;`;

    let lastErr: Error | undefined;
    for (const url of OVERPASS_URLS) {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), OVERPASS_TIMEOUT_MS);
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json',
            'User-Agent': 'Sentinella/1.0 (entomological surveillance)',
          },
          body: 'data=' + encodeURIComponent(query),
          signal: ctrl.signal,
        });
        clearTimeout(t);
        if (res.ok) {
          const data = await res.json() as { elements: OsmWay[] };
          return data.elements ?? [];
        }
        lastErr = new Error(`Overpass HTTP ${res.status} em ${url}`);
        if (![429, 502, 503, 504].includes(res.status)) break;
      } catch (e) {
        clearTimeout(t);
        lastErr = e as Error;
      }
    }
    this.logger.warn(`Overpass indisponível: ${lastErr?.message} — retornando 0 vias`);
    return [];
  }

  private bufferAndSubtract(
    areaPoly: AnyFeature,
    ways: OsmWay[],
    areaMinima: number,
  ): AnyFeature[] {
    // Buffer de cada via com largura proporcional ao tipo de via
    const buffers: AnyFeature[] = [];
    for (const way of ways) {
      if (!way.geometry || way.geometry.length < 2) continue;
      try {
        const coords = way.geometry.map(g => [g.lon, g.lat] as Coord);
        const line = turf.lineString(coords);
        const width = HIGHWAY_WIDTH[way.tags?.highway ?? ''] ?? DEFAULT_WIDTH;
        const buf = turf.buffer(line, width / 2, { units: 'meters' });
        if (buf) buffers.push(buf as unknown as AnyFeature);
      } catch {
        // ignora via com geometria inválida
      }
    }

    if (buffers.length === 0) {
      return turf.area(areaPoly as Parameters<typeof turf.area>[0]) >= areaMinima ? [areaPoly] : [];
    }

    // União iterativa dos buffers
    let roadUnion: AnyFeature = buffers[0];
    for (let i = 1; i < buffers.length; i++) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const u = turf.union(turf.featureCollection([roadUnion, buffers[i]] as any));
        if (u) roadUnion = u as unknown as AnyFeature;
      } catch {
        // pula buffer problemático
      }
    }

    // Diferença: área_bairro - ruas = miolos candidatos
    let diff: AnyFeature | null = null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      diff = turf.difference(turf.featureCollection([areaPoly, roadUnion] as any)) as unknown as AnyFeature | null;
    } catch (e) {
      this.logger.warn(`turf.difference falhou: ${String(e)} — retornando área inteira`);
      return turf.area(areaPoly as Parameters<typeof turf.area>[0]) >= areaMinima ? [areaPoly] : [];
    }
    if (!diff) return [];

    // Explodir MultiPolygon → Polygons individuais
    const candidatos: AnyFeature[] = [];
    const geom = diff.geometry;
    if (geom.type === 'Polygon') {
      candidatos.push(turf.polygon(geom.coordinates as Coord[][]) as unknown as AnyFeature);
    } else if (geom.type === 'MultiPolygon') {
      for (const ringSet of geom.coordinates) {
        try {
          candidatos.push(turf.polygon(ringSet as Coord[][]) as unknown as AnyFeature);
        } catch { /* ignora fragmento inválido */ }
      }
    }

    // Filtrar por área mínima e simplificar levemente para reduzir payload
    return candidatos
      .filter(p => turf.area(p as Parameters<typeof turf.area>[0]) >= areaMinima)
      .map(p => {
        try {
          return turf.simplify(p as Parameters<typeof turf.simplify>[0], { tolerance: 0.000005, highQuality: false }) as unknown as AnyFeature;
        } catch { return p; }
      });
  }
}
