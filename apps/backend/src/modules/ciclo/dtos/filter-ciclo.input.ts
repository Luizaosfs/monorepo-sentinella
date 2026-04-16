import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const filterCicloSchema = z.object({
  clienteId: z.string().uuid().describe('Filtrar por cliente').optional(),
  ano: z.coerce.number().int().describe('Filtrar por ano').optional(),
  status: z
    .string()
    .describe('Filtrar por status (planejamento | ativo | fechado)')
    .optional(),
});

export class FilterCicloInput extends createZodDto(filterCicloSchema) {}
