import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const operacaoRowSchema = z.object({
  itemLevantamentoId: z.string().uuid(),
  status:             z.string().default('pendente'),
  prioridade:         z.string().optional().nullable(),
  responsavelId:      z.string().uuid().optional().nullable(),
  observacao:         z.string().optional().nullable(),
  tipoVinculo:        z.string().optional().default('levantamento'),
});

export const bulkInsertOperacoesSchema = z.object({
  operacoes: z.array(operacaoRowSchema).min(1),
});

export type BulkInsertOperacoesInput = z.infer<typeof bulkInsertOperacoesSchema>;
export class BulkInsertOperacoesBody extends createZodDto(bulkInsertOperacoesSchema) {}
