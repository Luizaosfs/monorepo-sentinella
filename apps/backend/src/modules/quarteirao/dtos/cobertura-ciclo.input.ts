import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const coberturaCicloSchema = z.object({
  clienteId: z.string().uuid().optional(),
  ciclo: z.coerce.number().int(),
});

export class CoberturaCicloInput extends createZodDto(coberturaCicloSchema) {}
