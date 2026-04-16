import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const filterReinspecaoSchema = z.object({
  clienteId: z.string().uuid().optional(),
  focoRiscoId: z.string().uuid().optional(),
  status: z.enum(['pendente', 'realizada', 'cancelada', 'vencida']).optional(),
});

export class FilterReinspecaoInput extends createZodDto(filterReinspecaoSchema) {}
