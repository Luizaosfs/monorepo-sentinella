import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const filterVistoriaConsolidadasSchema = z.object({
  prioridade_final: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((v) => (v ? (Array.isArray(v) ? v : [v]) : undefined)),
  alerta_saude: z.string().optional(),
  risco_vetorial: z.string().optional(),
  consolidacao_incompleta: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((v) => {
      if (v === undefined) return undefined;
      if (typeof v === 'boolean') return v;
      return v === 'true';
    }),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export type FilterVistoriaConsolidadasInput = z.infer<
  typeof filterVistoriaConsolidadasSchema
>;

export class FilterVistoriaConsolidadasQuery extends createZodDto(
  filterVistoriaConsolidadasSchema,
) {}
