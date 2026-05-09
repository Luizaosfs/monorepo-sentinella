import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const polygonGeoJSONSchema = z.object({
  type: z.literal('Polygon'),
  coordinates: z
    .array(z.array(z.tuple([z.number(), z.number()])).min(3))
    .min(1)
    .describe('Anéis do Polygon GeoJSON — primeiro é o anel exterior (mín. 3 pontos)'),
});

export const desenharQuarteiraoSchema = z.object({
  regiaoId: z
    .string({ required_error: 'Região obrigatória' })
    .uuid('regiaoId deve ser UUID'),
  codigo: z
    .string({ required_error: 'Código obrigatório' })
    .trim()
    .min(1, 'Código não pode ser vazio')
    .max(20, 'Código máximo 20 caracteres')
    .transform((v) => v.toUpperCase()),
  geojson: polygonGeoJSONSchema.describe(
    'Polígono GeoJSON do quarteirão (type: Polygon, coordinates em [lng, lat])',
  ),
  areaM2: z.number().int().positive().optional(),
});

export type DesenharQuarteiraoInput = z.infer<typeof desenharQuarteiraoSchema>;
export class DesenharQuarteiraoBody extends createZodDto(desenharQuarteiraoSchema) {}
