import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const concluirParaItemSchema = z.object({
  itemLevantamentoId: z.string().uuid({ message: 'itemLevantamentoId inválido' }),
  observacao:         z.string().optional().nullable(),
});

export type ConcluirParaItemInput = z.infer<typeof concluirParaItemSchema>;
export class ConcluirParaItemBody extends createZodDto(concluirParaItemSchema) {}
