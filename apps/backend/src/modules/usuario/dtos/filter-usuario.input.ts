import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const filterUsuarioSchema = z.object({
  nome: z.string().optional(),
  email: z.string().optional(),
  papel: z
    .enum(['admin', 'supervisor', 'agente', 'notificador', 'analista_regional'])
    .optional(),
  ativo: z
    .preprocess((v) => v === 'true' || v === true, z.boolean())
    .optional(),
  clienteId: z.string().uuid().optional(),
});

export class FilterUsuarioInput extends createZodDto(filterUsuarioSchema) {}
