import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const filterOperacaoSchema = z.object({
  clienteId: z
    .string()
    .uuid()
    .optional()
    .describe('Filtrar por cliente (admin only)'),
  status: z.string().optional().describe('Filtrar por status'),
  prioridade: z.string().optional().describe('Filtrar por prioridade'),
  responsavelId: z
    .string()
    .uuid()
    .optional()
    .describe('Filtrar por responsável'),
  tipoVinculo: z.string().optional().describe('Filtrar por tipo de vínculo'),
  focoRiscoId: z
    .string()
    .uuid()
    .optional()
    .describe('Filtrar por foco de risco'),
});

export type FilterOperacaoInput = z.infer<typeof filterOperacaoSchema>;

export class FilterOperacaoQuery extends createZodDto(filterOperacaoSchema) {}
