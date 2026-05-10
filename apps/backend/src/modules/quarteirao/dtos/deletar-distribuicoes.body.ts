import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const deletarDistribuicoesSchema = z.object({
  cicloId:   z.string().uuid(),
  quadraIds: z.array(z.string().uuid()).min(1),
});
export class DeletarDistribuicoesBody extends createZodDto(deletarDistribuicoesSchema) {}
export type DeletarDistribuicoesInput = z.infer<typeof deletarDistribuicoesSchema>;
