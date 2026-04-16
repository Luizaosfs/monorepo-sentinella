import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const createPluvioRunSchema = z.object({
  clienteId: z
    .string({ required_error: 'clienteId obrigatório' })
    .uuid('clienteId inválido')
    .describe('ID do cliente (tenant)'),
  dataReferencia: z.coerce
    .date({ required_error: 'Data de referência obrigatória' })
    .describe('Data de referência do run pluviométrico'),
  total: z.coerce.number().optional().describe('Precipitação total acumulada (mm)'),
  status: z
    .string()
    .optional()
    .default('pendente')
    .describe('Status do run (pendente, processado, erro)'),
});

export class CreatePluvioRunBody extends createZodDto(createPluvioRunSchema) {}
export type CreatePluvioRunInput = z.infer<typeof createPluvioRunSchema>;
