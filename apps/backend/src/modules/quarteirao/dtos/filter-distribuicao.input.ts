import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const filterDistribuicaoSchema = z.object({
  clienteId: z.string().uuid().optional(),
  cicloId:   z.string().uuid(),
});

export class FilterDistribuicaoInput extends createZodDto(
  filterDistribuicaoSchema,
) {}
