import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const quarteiraoItemNormalizedSchema = z.object({
  codigo:   z.string().min(1),
  bairro:   z.string().optional(),
  regiaoId: z.string().uuid().optional(),
  ativo:    z.boolean().optional(),
});

// Aceita aliases legados: quarteirao/code → codigo, nome/regiao → bairro
const quarteiraoItemSchema = z.preprocess((raw: unknown) => {
  if (typeof raw !== 'object' || raw === null) return raw;
  const r = raw as Record<string, unknown>;
  return {
    ...r,
    codigo: r.codigo ?? r.code ?? r.quarteirao,
    bairro: r.bairro ?? r.nome ?? r.regiao,
  };
}, quarteiraoItemNormalizedSchema);

export const bulkInsertQuarteiraoSchema = z.object({
  rows: z.array(quarteiraoItemSchema).min(1).max(1000),
});
export class BulkInsertQuarteiraoBody extends createZodDto(bulkInsertQuarteiraoSchema) {}
export type BulkInsertQuarteiraoInput = z.infer<typeof bulkInsertQuarteiraoSchema>;
