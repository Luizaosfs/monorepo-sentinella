import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const FOCO_STATUS = [
  'suspeita',
  'em_triagem',
  'aguarda_inspecao',
  'em_inspecao',
  'aguardando_nova_tentativa',
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
  bairro_id: z.string().uuid().describe('Filtrar por região').optional(),
  responsavel_id: z
    .string()
    .uuid()
    .describe('Filtrar por responsável')
    .optional(),
  /** true → WHERE responsavel_id IS NULL */
  semResponsavel: z.coerce.boolean().optional(),
  origem_tipo: z.string().describe('Filtrar por origem').optional(),
  classificacao_inicial: z.string().optional(),
  /** Intervalo de data — suspeita_em >= de */
  de: z.coerce.date().optional(),
  /** Intervalo de data — suspeita_em <= ate */
  ate: z.coerce.date().optional(),
  /** Paginação inline — compatibilidade com frontend (?page=1&pageSize=30). */
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(5000).optional(),
  /** Ordem combinada (?orderBy=suspeita_em_asc | suspeita_em_desc). Valores fora da lista são ignorados pelo repositório (fallback created_at). */
  orderBy: z
    .enum([
      'created_at_asc',       'created_at_desc',
      'updated_at_asc',       'updated_at_desc',
      'suspeita_em_asc',      'suspeita_em_desc',
      'score_prioridade_asc', 'score_prioridade_desc',
      'status_asc',           'status_desc',
      'prioridade_asc',       'prioridade_desc',
      'codigo_foco_asc',      'codigo_foco_desc',
      'origem_tipo_asc',      'origem_tipo_desc',
      'inspecao_em_asc',      'inspecao_em_desc',
      'ultima_vistoria_em_asc', 'ultima_vistoria_em_desc',
    ])
    .optional(),
  /** Filtrar apenas focos aguardando decisão do supervisor (sem_previsao ou 3ª tentativa). */
  pendente_decisao_supervisor: z.coerce.boolean().optional(),
});

export class FilterFocoRiscoInput extends createZodDto(filterFocoRiscoSchema) {}

// Tipo inferido para uso em use-cases e repositórios
export type FilterFocoRiscoInputType = z.infer<typeof filterFocoRiscoSchema>;
