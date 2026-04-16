import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const filterPlanejamentoSchema = z.object({
  clienteId: z
    .string()
    .uuid()
    .optional()
    .describe('Filtrar por cliente (admin only)'),
  ativo: z.coerce.boolean().optional().describe('Filtrar por ativo'),
  tipoLevantamento: z
    .enum(['DRONE', 'MANUAL'])
    .optional()
    .describe('Filtrar por tipo de levantamento'),
  regiaoId: z.string().uuid().optional().describe('Filtrar por região'),
});

export type FilterPlanejamentoInput = z.infer<typeof filterPlanejamentoSchema>;

export class FilterPlanejamentoQuery extends createZodDto(
  filterPlanejamentoSchema,
) {}
