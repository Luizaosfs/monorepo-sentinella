import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const filterDistribuicaoTerritorialSchema = z.object({
  agenteId: z.string().uuid().optional(),
  bairroId: z.string().uuid().optional(),
});

export class FilterDistribuicaoTerritorialInput extends createZodDto(
  filterDistribuicaoTerritorialSchema,
) {}
