import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const filterVistoriaSchema = z.object({
  clienteId: z
    .string()
    .uuid()
    .optional()
    .describe('Filtrar por cliente (admin only)'),
  imovelId: z.string().uuid().optional().describe('Filtrar por imóvel'),
  agenteId: z.string().uuid().optional().describe('Filtrar por agente'),
  tipoAtividade: z
    .string()
    .optional()
    .describe('Filtrar por tipo de atividade'),
  ciclo: z.coerce.number().int().optional().describe('Filtrar por ciclo'),
  planejamentoId: z
    .string()
    .uuid()
    .optional()
    .describe('Filtrar por planejamento'),
  status: z.string().optional().describe('Filtrar por status'),
  focoRiscoId: z
    .string()
    .uuid()
    .optional()
    .describe('Filtrar por foco de risco vinculado'),
  dataInicio: z.coerce.date().optional().describe('Data inicial do período'),
  dataFim: z.coerce.date().optional().describe('Data final do período'),
  createdAfter: z.coerce.date().optional().describe('Filtrar por created_at >= data'),
  acessoRealizado: z
    .preprocess((v) => v === 'true' || v === true, z.boolean())
    .optional()
    .describe('Filtrar por acesso_realizado'),
});

export type FilterVistoriaInput = z.infer<typeof filterVistoriaSchema>;

export class FilterVistoriaQuery extends createZodDto(filterVistoriaSchema) {}
