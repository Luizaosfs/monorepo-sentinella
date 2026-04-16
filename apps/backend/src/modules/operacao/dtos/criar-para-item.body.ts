import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const criarParaItemSchema = z.object({
  itemLevantamentoId: z
    .string()
    .uuid({ message: 'ID do item de levantamento inválido' })
    .describe('ID do item de levantamento'),
  responsavelId: z.string().uuid().optional().describe('ID do responsável'),
  prioridade: z.string().optional().describe('Prioridade'),
  observacao: z.string().optional().describe('Observações'),
});

export class CriarParaItemBody extends createZodDto(criarParaItemSchema) {}
