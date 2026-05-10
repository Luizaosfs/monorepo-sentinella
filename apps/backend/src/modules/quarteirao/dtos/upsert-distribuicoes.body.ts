import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const upsertDistribuicoesSchema = z.object({
  rows: z
    .array(
      z.object({
        cicloId:  z.string().uuid(),
        quadraId: z.string().uuid(),
        agenteId: z.string().uuid(),
        bairroId: z.string().uuid().nullable().optional(),
      }),
    )
    .min(1),
});
export class UpsertDistribuicoesBody extends createZodDto(upsertDistribuicoesSchema) {}
export type UpsertDistribuicoesInput = z.infer<typeof upsertDistribuicoesSchema>;
