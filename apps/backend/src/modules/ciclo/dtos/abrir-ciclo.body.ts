import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const abrirCicloSchema = z.object({
  clienteId: z.string().uuid({ message: 'clienteId deve ser um UUID válido' }),
  numero: z
    .number({ required_error: 'número do bimestre é obrigatório' })
    .int()
    .min(1)
    .max(6),
  ano: z.number().int().optional(),
  metaCoberturaPct: z.number().min(0).max(100).optional(),
  observacao: z.string().optional(),
});

export type AbrirCicloInput = z.infer<typeof abrirCicloSchema>;

export class AbrirCicloBody extends createZodDto(abrirCicloSchema) {}
