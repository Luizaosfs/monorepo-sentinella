import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const coberturaCicloSchema = z.object({
  clienteId: z.string().uuid().optional(),
  cicloId:   z.string().uuid(),
});

export class CoberturaCicloInput extends createZodDto(coberturaCicloSchema) {}
