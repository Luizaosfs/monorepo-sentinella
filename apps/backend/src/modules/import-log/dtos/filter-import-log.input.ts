import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const filterImportLogSchema = z.object({
  clienteId: z.string().uuid().describe('Filtrar por município (tenant)').optional(),
  status: z
    .enum(['em_andamento', 'concluido', 'erro'])
    .describe('Filtrar por status do processamento')
    .optional(),
});

export class FilterImportLogInput extends createZodDto(filterImportLogSchema) {}
