import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const saveOperacaoSchema = z.object({
  status: z
    .enum(['pendente', 'em_andamento', 'concluido'])
    .optional()
    .describe('Status da operação'),
  prioridade: z.string().optional().describe('Prioridade'),
  responsavelId: z.string().uuid().optional().describe('ID do responsável'),
  observacao: z.string().optional().describe('Observações'),
});

export class SaveOperacaoBody extends createZodDto(saveOperacaoSchema) {}
