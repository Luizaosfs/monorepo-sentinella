import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const filterDistribuicaoSchema = z.object({
  clienteId: z.string().uuid().optional(),
  ciclo: z.coerce.number().int(),
});

export class FilterDistribuicaoInput extends createZodDto(
  filterDistribuicaoSchema,
) {}
