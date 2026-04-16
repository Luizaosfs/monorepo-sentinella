import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const filterFocoRiscoSchema = z.object({
  clienteId: z.string().uuid().describe('Filtrar por cliente').optional(),
  status: z
    .enum([
      'suspeita',
      'em_triagem',
      'aguarda_inspecao',
      'em_inspecao',
      'confirmado',
      'em_tratamento',
      'resolvido',
      'descartado',
    ])
    .describe('Filtrar por status')
    .optional(),
  prioridade: z
    .enum(['baixa', 'media', 'alta', 'critica'])
    .describe('Filtrar por prioridade')
    .optional(),
  regiaoId: z.string().uuid().describe('Filtrar por região').optional(),
  responsavelId: z
    .string()
    .uuid()
    .describe('Filtrar por responsável')
    .optional(),
  origemTipo: z.string().describe('Filtrar por origem').optional(),
});

export class FilterFocoRiscoInput extends createZodDto(filterFocoRiscoSchema) {}
