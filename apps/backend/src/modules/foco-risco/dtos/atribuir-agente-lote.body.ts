import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const atribuirAgenteLoteSchema = z.object({
  focoIds: z
    .array(z.string().uuid({ message: 'Cada focoId deve ser um UUID válido' }))
    .min(1, { message: 'focoIds deve conter ao menos 1 item' }),
  agenteId: z.string().uuid({ message: 'agenteId deve ser um UUID válido' }),
  motivo: z.string().optional(),
});

export type AtribuirAgenteLoteInput = z.infer<typeof atribuirAgenteLoteSchema>;

export class AtribuirAgenteLoteBody extends createZodDto(
  atribuirAgenteLoteSchema,
) {}
