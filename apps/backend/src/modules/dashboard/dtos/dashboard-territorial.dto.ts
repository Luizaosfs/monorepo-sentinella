import { z } from 'zod';

/**
 * Query params do dashboard territorial municipal.
 * clienteId NÃO é aceito aqui — vem exclusivamente do JWT via requireTenantId.
 * pontosMapa.peso é peso visual para heatmap (prioridade real P1–P5), não índice sanitário.
 */
export const dashboardTerritorialQuerySchema = z.object({
  dataInicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato esperado: YYYY-MM-DD').optional(),
  dataFim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato esperado: YYYY-MM-DD').optional(),
  bairro: z.string().min(1).optional(),
  regiaoId: z.string().uuid().optional(),
  prioridade: z.enum(['P1', 'P2', 'P3', 'P4', 'P5']).optional(),
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
    .optional(),
  agenteId: z.string().uuid().optional(),
});

export type DashboardTerritorialQuery = z.infer<typeof dashboardTerritorialQuerySchema>;
