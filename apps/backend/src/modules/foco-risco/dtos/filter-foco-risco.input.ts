import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const FOCO_STATUS = [
  'suspeita',
  'em_triagem',
  'aguarda_inspecao',
  'em_inspecao',
  'confirmado',
  'em_tratamento',
  'resolvido',
  'descartado',
] as const;

export const filterFocoRiscoSchema = z.object({
  clienteId: z.string().uuid().describe('Filtrar por cliente').optional(),
  /** Aceita único valor ou array repetido (?status=x&status=y). */
  status: z
    .preprocess(
      (val) => (Array.isArray(val) ? val : val != null ? [val] : undefined),
      z.array(z.enum(FOCO_STATUS)).optional(),
    )
    .describe('Filtrar por status (múltiplos permitidos)'),
  /** Aceita único valor ou array repetido (?prioridade=P1&prioridade=P2). */
  prioridade: z
    .preprocess(
      (val) => (Array.isArray(val) ? val : val != null ? [val] : undefined),
      z.array(z.enum(['P1', 'P2', 'P3', 'P4', 'P5'])).optional(),
    )
    .describe('Filtrar por prioridade (múltiplos permitidos)'),
  regiaoId: z.string().uuid().describe('Filtrar por região').optional(),
  responsavelId: z
    .string()
    .uuid()
    .describe('Filtrar por responsável')
    .optional(),
  origemTipo: z.string().describe('Filtrar por origem').optional(),
  /** Paginação inline — compatibilidade com frontend (?page=1&pageSize=30). */
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(5000).optional(),
  /** Ordem combinada (?orderBy=suspeita_em_asc | suspeita_em_desc). */
  orderBy: z.string().optional(),
});

export class FilterFocoRiscoInput extends createZodDto(filterFocoRiscoSchema) {}

// Tipo inferido para uso em use-cases e repositórios
export type FilterFocoRiscoInputType = z.infer<typeof filterFocoRiscoSchema>;
