import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const filterReinspecaoSchema = z.object({
  clienteId: z.string().uuid().optional(),
  focoRiscoId: z.string().uuid().optional(),
  agenteId: z.string().uuid().optional(),
  /** Aceita único valor ou array repetido (?status=x&status=y). */
  status: z
    .preprocess(
      (val) => (Array.isArray(val) ? val : val != null ? [val] : undefined),
      z.array(z.enum(['pendente', 'realizada', 'cancelada', 'vencida'])).optional(),
    )
    .describe('Filtrar por status (múltiplos permitidos)'),
});

export class FilterReinspecaoInput extends createZodDto(filterReinspecaoSchema) {}
