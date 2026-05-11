import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const polygonCoordSchema = z.tuple([z.number(), z.number()]);

const polygonGeoJSONSchema = z.object({
  type: z.literal('Polygon'),
  coordinates: z.array(z.array(polygonCoordSchema)).min(1),
});

export const gerarQuadrasOSMSchema = z.object({
  bairroId: z.string().uuid(),
  geojson: polygonGeoJSONSchema,
  prefixo: z.string().min(1).max(10).default('Q'),
  areaMinima: z.number().int().min(50).max(50000).default(2000),
});

export type GerarQuadrasOSMInput = z.infer<typeof gerarQuadrasOSMSchema>;
export class GerarQuadrasOSMBody extends createZodDto(gerarQuadrasOSMSchema) {}
