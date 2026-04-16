import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const fecharCicloSchema = z.object({
  clienteId: z.string().uuid({ message: 'clienteId deve ser um UUID válido' }),
  numero: z
    .number({ required_error: 'número do bimestre é obrigatório' })
    .int()
    .min(1)
    .max(6),
  ano: z.number().int().optional(),
  observacao: z.string().optional(),
});

export type FecharCicloInput = z.infer<typeof fecharCicloSchema>;

export class FecharCicloBody extends createZodDto(fecharCicloSchema) {}
