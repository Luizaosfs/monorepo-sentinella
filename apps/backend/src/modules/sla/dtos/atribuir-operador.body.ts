import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const atribuirOperadorSchema = z.object({
  operadorId: z.string().uuid().describe('ID do operador a atribuir'),
  avancarStatus: z
    .boolean()
    .optional()
    .default(false)
    .describe('Se true, avança status para em_atendimento'),
});

export class AtribuirOperadorBody extends createZodDto(
  atribuirOperadorSchema,
) {}
