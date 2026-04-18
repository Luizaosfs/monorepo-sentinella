import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const saveUsuarioSchema = z.object({
  nome: z.string().min(1).optional(),
  ativo: z.boolean().optional(),
  onboardingConcluido: z.boolean().optional(),
  papeis: z
    .array(z.enum(['admin', 'supervisor', 'agente', 'notificador', 'analista_regional']))
    .optional(),
});

export class SaveUsuarioBody extends createZodDto(saveUsuarioSchema) {}
