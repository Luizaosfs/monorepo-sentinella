import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const createLevantamentoSchema = z.object({
  planejamentoId: z.string().uuid().describe('ID do planejamento').optional(),
  cicloId: z.string().uuid().describe('ID do ciclo').optional(),
  idDrone: z.string().describe('ID do drone utilizado').optional(),
  usuarioId: z
    .string()
    .uuid()
    .describe('ID do usuário responsável (padrão: usuário logado)')
    .optional(),
  titulo: z.string().describe('Título do levantamento').optional(),
  tipoEntrada: z
    .string()
    .describe('Tipo de entrada (ex: drone, manual, lote)')
    .optional(),
  configFonte: z.string().describe('Configuração da fonte de dados').optional(),
  dataVoo: z.coerce.date().describe('Data do voo').optional(),
  observacao: z.string().describe('Observações gerais').optional(),
});

export class CreateLevantamentoBody extends createZodDto(
  createLevantamentoSchema,
) {}
