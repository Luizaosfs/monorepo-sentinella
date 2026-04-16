import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const filterQuarteiraoSchema = z.object({
  clienteId: z.string().uuid().describe('Filtrar por cliente').optional(),
  codigo: z.string().optional(),
  regiaoId: z.string().uuid().optional(),
  ativo: z
    .preprocess((v) => v === 'true' || v === true, z.boolean())
    .optional(),
});

export class FilterQuarteiraoInput extends createZodDto(filterQuarteiraoSchema) {}
