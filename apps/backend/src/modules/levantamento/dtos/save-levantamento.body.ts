import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const saveLevantamentoSchema = z.object({
  planejamentoId: z.string().uuid().describe('ID do planejamento').optional(),
  cicloId: z.string().uuid().describe('ID do ciclo').optional(),
  usuarioId: z
    .string()
    .uuid()
    .describe('ID do usuário responsável')
    .optional(),
  titulo: z.string().describe('Título do levantamento').optional(),
  tipoEntrada: z.string().describe('Tipo de entrada').optional(),
  statusProcessamento: z
    .enum(['aguardando', 'processando', 'concluido', 'erro', 'cancelado'])
    .describe('Status do processamento')
    .optional(),
  observacao: z.string().describe('Observações gerais').optional(),
  concluidoEm: z.coerce
    .string()
    .transform((v) => (v ? new Date(v) : undefined))
    .describe('Data de conclusão')
    .optional(),
});

export class SaveLevantamentoBody extends createZodDto(
  saveLevantamentoSchema,
) {}
