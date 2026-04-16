import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const filterRegiaoSchema = z.object({
  clienteId: z.string().uuid().describe('Filtrar por cliente').optional(),
  nome: z.string().describe('Filtrar por nome (busca parcial)').optional(),
  ativo: z
    .preprocess((v) => v === 'true' || v === true, z.boolean())
    .describe('Filtrar por status ativo')
    .optional(),
});

export class FilterRegiaoInput extends createZodDto(filterRegiaoSchema) {}
