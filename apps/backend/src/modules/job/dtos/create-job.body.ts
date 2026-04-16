import { jsonRecordOptional } from '@shared/dtos/zod-coercion';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const createJobSchema = z.object({
  tipo: z
    .string({ required_error: 'Tipo obrigatório' })
    .describe(
      'Tipo do job (billing-snapshot, sla-marcar-vencidos, cloudinary-cleanup, cnes-sync, relatorio-semanal, resumo-diario, score-worker, limpeza-logs)',
    ),
  payload: jsonRecordOptional(
    'Dados de entrada para o job (clienteId, filtros, etc.)',
  ),
  agendadoEm: z.coerce
    .date()
    .optional()
    .describe(
      'Data/hora para execução agendada (null = executar imediatamente na próxima rodada)',
    ),
});
export class CreateJobBody extends createZodDto(createJobSchema) {}
