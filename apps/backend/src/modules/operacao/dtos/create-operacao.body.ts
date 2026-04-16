import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const createOperacaoSchema = z.object({
  status: z
    .enum(['pendente', 'em_andamento'])
    .default('pendente')
    .describe('Status inicial'),
  prioridade: z.string().optional().describe('Prioridade da operação'),
  responsavelId: z.string().uuid().optional().describe('ID do responsável'),
  observacao: z.string().optional().describe('Observações'),
  tipoVinculo: z
    .enum(['operacional', 'levantamento', 'regiao'])
    .optional()
    .describe('Tipo de vínculo'),
  itemOperacionalId: z
    .string()
    .uuid()
    .optional()
    .describe('ID do item operacional vinculado'),
  itemLevantamentoId: z
    .string()
    .uuid()
    .optional()
    .describe('ID do item de levantamento vinculado'),
  regiaoId: z.string().uuid().optional().describe('ID da região vinculada'),
  focoRiscoId: z
    .string()
    .uuid()
    .optional()
    .describe('ID do foco de risco vinculado'),
  clienteId: z
    .string()
    .uuid()
    .optional()
    .describe('ID do cliente (preenchido pelo backend)'),
});

export class CreateOperacaoBody extends createZodDto(createOperacaoSchema) {}
