import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const upsertDistribuicoesSchema = z.object({
  rows: z
    .array(
      z.object({
        ciclo:     z.coerce.number().int(),
        quarteirao: z.string().min(1),
        agenteId:  z.string().uuid(),
        regiaoId:  z.string().uuid().nullable().optional(),
      }),
    )
    .min(1),
});
export class UpsertDistribuicoesBody extends createZodDto(upsertDistribuicoesSchema) {}
export type UpsertDistribuicoesInput = z.infer<typeof upsertDistribuicoesSchema>;
