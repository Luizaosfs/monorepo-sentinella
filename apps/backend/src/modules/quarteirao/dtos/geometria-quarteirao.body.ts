import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const geometriaQuarteiraoSchema = z.object({
  geojson: z
    .union([
      z.object({
        type: z.literal('Polygon'),
        coordinates: z.array(z.array(z.tuple([z.number(), z.number()]))).min(1),
      }),
      z.null(),
    ])
    .describe('Polígono GeoJSON (type: Polygon, coordinates em [lng, lat]) ou null para remover'),
});

export type GeometriaQuarteiraoInput = z.infer<typeof geometriaQuarteiraoSchema>;
export class GeometriaQuarteiraoBody extends createZodDto(geometriaQuarteiraoSchema) {}
