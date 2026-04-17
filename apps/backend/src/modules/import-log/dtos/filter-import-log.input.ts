import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const filterImportLogSchema = z.object({
  clienteId: z.string().uuid().describe('Filtrar por município (tenant)').optional(),
  /** Aceita único valor ou array repetido (?status=x&status=y). */
  status: z
    .preprocess(
      (val) => (Array.isArray(val) ? val : val != null ? [val] : undefined),
      z.array(z.enum(['em_andamento', 'concluido', 'erro'])).optional(),
    )
    .describe('Filtrar por status do processamento (múltiplos permitidos)'),
});

export class FilterImportLogInput extends createZodDto(filterImportLogSchema) {}
