import { jsonRecordOptional } from '@shared/dtos/zod-coercion';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const createRelatorioSchema = z.object({
  periodoInicio: z.coerce
    .date({ required_error: 'Período início obrigatório' })
    .describe('Data de início do período do relatório'),
  periodoFim: z.coerce
    .date({ required_error: 'Período fim obrigatório' })
    .describe('Data de fim do período do relatório'),
  payload: jsonRecordOptional(
    'Dados adicionais do relatório (métricas, gráficos, etc.)',
  ).default({}),
});
export class CreateRelatorioBody extends createZodDto(createRelatorioSchema) {}
