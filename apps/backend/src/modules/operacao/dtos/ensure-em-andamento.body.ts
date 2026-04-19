import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const ensureEmAndamentoSchema = z.object({
  itemLevantamentoId: z.string().uuid().optional(),
  focoRiscoId:        z.string().uuid().optional(),
  responsavelId:      z.string().uuid().optional().nullable(),
  prioridade:         z.string().optional().nullable(),
  observacao:         z.string().optional().nullable(),
  tipoVinculo:        z.string().optional(),
});

export type EnsureEmAndamentoInput = z.infer<typeof ensureEmAndamentoSchema>;
export class EnsureEmAndamentoBody extends createZodDto(ensureEmAndamentoSchema) {}
