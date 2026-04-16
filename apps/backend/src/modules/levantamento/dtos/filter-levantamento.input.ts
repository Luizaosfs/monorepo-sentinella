import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const filterLevantamentoSchema = z.object({
  clienteId: z.string().uuid().describe('Filtrar por cliente').optional(),
  planejamentoId: z.string().uuid().describe('Filtrar por planejamento').optional(),
  cicloId: z.string().uuid().describe('Filtrar por ciclo').optional(),
  usuarioId: z
    .string()
    .uuid()
    .describe('Filtrar por usuário responsável')
    .optional(),
  tipoEntrada: z.string().describe('Filtrar por tipo de entrada').optional(),
  statusProcessamento: z.string().describe('Filtrar por status de processamento').optional(),
});

export class FilterLevantamentoInput extends createZodDto(
  filterLevantamentoSchema,
) {}
