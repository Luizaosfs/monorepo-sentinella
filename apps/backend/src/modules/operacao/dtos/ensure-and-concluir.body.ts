import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const ensureAndConcluirSchema = z.object({
  itemLevantamentoId: z.string().uuid().optional(),
  focoRiscoId:        z.string().uuid().optional(),
  responsavelId:      z.string().uuid().optional().nullable(),
  prioridade:         z.string().optional().nullable(),
  observacao:         z.string().optional().nullable(),
  tipoVinculo:        z.string().optional(),
});

export type EnsureAndConcluirInput = z.infer<typeof ensureAndConcluirSchema>;
export class EnsureAndConcluirBody extends createZodDto(ensureAndConcluirSchema) {}
