import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const upsertOperacaoSchema = z.object({
  id:          z.string().uuid().optional(),
  status:      z.string({ required_error: 'Status obrigatório' }),
  prioridade:  z.string().optional().nullable(),
  responsavelId: z.string().uuid().optional().nullable(),
  observacao:  z.string().optional().nullable(),
  prevStatus:  z.string().optional(),
});

export type UpsertOperacaoInput = z.infer<typeof upsertOperacaoSchema>;
export class UpsertOperacaoBody extends createZodDto(upsertOperacaoSchema) {}
