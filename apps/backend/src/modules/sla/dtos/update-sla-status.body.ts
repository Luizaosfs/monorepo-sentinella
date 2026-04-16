import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const updateSlaStatusSchema = z.object({
  status: z
    .enum(['pendente', 'em_atendimento', 'concluido', 'vencido'])
    .describe('Novo status do SLA'),
});

export class UpdateSlaStatusBody extends createZodDto(updateSlaStatusSchema) {}
