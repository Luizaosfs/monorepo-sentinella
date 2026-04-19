import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const regiaoItemSchema = z.object({
  nome:        z.string().min(1),
  tipo:        z.string().optional(),
  cor:         z.string().optional(),
  geojson:     z.unknown().optional(),
  latCentroid: z.number().optional(),
  lngCentroid: z.number().optional(),
  municipio:   z.string().optional(),
  uf:          z.string().optional(),
  ativo:       z.boolean().optional(),
});

export const bulkInsertRegioesSchema = z.object({
  rows: z.array(regiaoItemSchema).min(1).max(500),
});
export class BulkInsertRegioesBody extends createZodDto(bulkInsertRegioesSchema) {}
export type BulkInsertRegioesInput = z.infer<typeof bulkInsertRegioesSchema>;
