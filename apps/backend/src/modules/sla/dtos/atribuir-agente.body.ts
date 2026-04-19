import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const atribuirAgenteSchema = z.object({
  agenteId: z.string().uuid().describe('ID do agente a atribuir'),
  avancarStatus: z
    .boolean()
    .optional()
    .default(false)
    .describe('Se true, avança status para em_atendimento'),
});

export class AtribuirAgenteBody extends createZodDto(atribuirAgenteSchema) {}
