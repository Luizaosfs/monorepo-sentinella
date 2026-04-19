import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const deletarDistribuicoesSchema = z.object({
  ciclo:       z.coerce.number().int(),
  quarteiroes: z.array(z.string().min(1)).min(1),
});
export class DeletarDistribuicoesBody extends createZodDto(deletarDistribuicoesSchema) {}
export type DeletarDistribuicoesInput = z.infer<typeof deletarDistribuicoesSchema>;
