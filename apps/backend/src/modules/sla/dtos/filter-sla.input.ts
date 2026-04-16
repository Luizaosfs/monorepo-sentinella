import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const filterSlaSchema = z.object({
  clienteId: z
    .string()
    .uuid()
    .optional()
    .describe('Filtrar por cliente (admin only)'),
  operadorId: z.string().uuid().optional().describe('Filtrar por operador'),
  status: z.string().optional().describe('Filtrar por status'),
  prioridade: z.string().optional().describe('Filtrar por prioridade'),
  focoRiscoId: z
    .string()
    .uuid()
    .optional()
    .describe('Filtrar por foco de risco'),
  violado: z.coerce.boolean().optional().describe('Filtrar por violação'),
});

export type FilterSlaInput = z.infer<typeof filterSlaSchema>;

export class FilterSlaQuery extends createZodDto(filterSlaSchema) {}
