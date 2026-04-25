import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const atribuirPapelSchema = z.object({
  papel: z.enum(['admin', 'supervisor', 'agente', 'notificador', 'analista_regional']),
});

export class AtribuirPapelBody extends createZodDto(atribuirPapelSchema) {}
