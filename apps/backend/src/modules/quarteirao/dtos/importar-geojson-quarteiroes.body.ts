import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const polygonGeoJSONSchema = z.object({
  type: z.literal('Polygon'),
  coordinates: z
    .array(z.array(z.tuple([z.number(), z.number()])).min(3))
    .min(1),
});

const featureSchema = z.object({
  codigo: z.string().min(1).max(20).transform((v) => v.trim().toUpperCase()),
  geojson: polygonGeoJSONSchema,
  /** UUID da região — opcional; backend resolve via PostGIS quando ausente */
  regiaoId: z.string().uuid().optional(),
  /** Nome do bairro — fallback antes da resolução espacial */
  bairro: z.string().optional(),
  /** Área em m² pré-calculada (ex: via turf.area) — persistida para uso operacional */
  areaM2: z.number().int().positive().optional(),
});

export const importarGeoJSONSchema = z.object({
  features: z.array(featureSchema).min(1).max(500),
});

export type ImportarGeoJSONInput = z.infer<typeof importarGeoJSONSchema>;
export class ImportarGeoJSONBody extends createZodDto(importarGeoJSONSchema) {}
