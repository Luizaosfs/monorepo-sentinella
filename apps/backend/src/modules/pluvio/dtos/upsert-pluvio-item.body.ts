import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const upsertPluvioItemSchema = z.object({
  id: z.string().uuid().optional().describe('ID do item (para atualização)'),
  runId: z
    .string({ required_error: 'runId obrigatório' })
    .uuid('runId inválido')
    .describe('ID do run pluviométrico'),
  regiaoId: z.string().uuid().optional().describe('ID da região associada'),
  imovelId: z.string().uuid().optional().describe('ID do imóvel associado'),
  precipitacao: z.coerce
    .number({ required_error: 'Precipitação obrigatória' })
    .describe('Precipitação registrada (mm)'),
  nivelRisco: z
    .string({ required_error: 'Nível de risco obrigatório' })
    .describe('Nível de risco (baixo, medio, alto, critico)'),
});

export class UpsertPluvioItemBody extends createZodDto(upsertPluvioItemSchema) {}
export type UpsertPluvioItemInput = z.infer<typeof upsertPluvioItemSchema>;

export const bulkInsertItemsSchema = z.object({
  items: z.array(upsertPluvioItemSchema).min(1, 'Informe ao menos um item'),
});

export class BulkInsertItemsBody extends createZodDto(bulkInsertItemsSchema) {}
export type BulkInsertItemsInput = z.infer<typeof bulkInsertItemsSchema>;
