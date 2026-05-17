import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const saveUsuarioSchema = z.object({
  nome: z.string().min(1).optional(),
  ativo: z.boolean().optional(),
  onboardingConcluido: z.boolean().optional(),
  unidadeSaudeId: z
    .string()
    .uuid('unidadeSaudeId inválido')
    .nullable()
    .optional()
    .describe('Unidade de saúde vinculada (obrigatória para notificador)'),
  papeis: z
    .array(z.enum(['admin', 'supervisor', 'agente', 'notificador', 'analista_regional']))
    .optional(),
});

export class SaveUsuarioBody extends createZodDto(saveUsuarioSchema) {}
