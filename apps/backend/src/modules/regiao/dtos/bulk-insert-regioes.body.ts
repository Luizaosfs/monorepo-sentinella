import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const regiaoItemNormalizedSchema = z.object({
  nome:      z.string().min(1),
  cor:       z.string().optional(),
  geojson:   z.unknown().optional(),
  latitude:  z.number().nullish(),
  longitude: z.number().nullish(),
  ativo:     z.boolean().optional(),
});

// Aceita tanto os nomes novos (latitude/longitude/nome) quanto os legados (lat/lon/bairro)
const regiaoItemSchema = z.preprocess((raw: unknown) => {
  if (typeof raw !== 'object' || raw === null) return raw;
  const r = raw as Record<string, unknown>;
  return {
    ...r,
    nome:      r.nome      ?? r.bairro,
    latitude:  r.latitude  ?? r.lat,
    longitude: r.longitude ?? r.lon,
  };
}, regiaoItemNormalizedSchema);

export const bulkInsertRegioesSchema = z.object({
  rows: z.array(regiaoItemSchema).min(1).max(500),
});
export class BulkInsertRegioesBody extends createZodDto(bulkInsertRegioesSchema) {}
export type BulkInsertRegioesInput = z.infer<typeof bulkInsertRegioesSchema>;
