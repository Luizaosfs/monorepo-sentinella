import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/** ID do foco vem da rota (`:id`); body só com dados da atribuição. */
export const atribuirAgenteSchema = z.object({
  agenteId: z.string().uuid({ message: 'agenteId deve ser um UUID válido' }),
  motivo: z.string().optional(),
});

export type AtribuirAgenteInput = z.infer<typeof atribuirAgenteSchema>;

export class AtribuirAgenteBody extends createZodDto(atribuirAgenteSchema) {}
