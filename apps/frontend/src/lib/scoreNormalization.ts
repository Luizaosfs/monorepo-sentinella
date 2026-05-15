/**
 * Normalização e classificação do score YOLO.
 *
 * Funções puras extraídas de `components/levantamentos/detail/ItemScoreBadge.tsx`
 * para respeitar a pureza do Vite Fast Refresh (arquivo de componente exporta só
 * componente). Consumidores devem importar daqui.
 */

export function normalizeScore(raw: number | null | undefined): number | null {
  if (raw == null) return null;
  return raw > 1 ? raw / 100 : raw;
}

/**
 * Mapeia score YOLO normalizado (0–1) para prioridade operacional sugerida.
 *
 * Regra canônica (CLAUDE.md):
 *   >= 0.85 → Alta      (alta certeza de foco real — atendimento prioritário)
 *   >= 0.65 → Média     (provável foco — vistoria recomendada)
 *   >= 0.45 → Baixa     (incerto — confirmar em campo)
 *    < 0.45 → Monitoramento (baixa certeza — não bloquear SLA)
 *
 * ATENÇÃO: esta função retorna uma SUGESTÃO. A prioridade real do item é definida
 * pelo pipeline Python e armazenada em levantamento_itens.prioridade — nunca
 * sobrescrever a prioridade real com este valor sem intervenção do usuário.
 */
export function scoreToPrioridadeSugerida(
  score: number | null | undefined,
): 'Alta' | 'Média' | 'Baixa' | 'Monitoramento' | null {
  if (score == null) return null;
  const s = score > 1 ? score / 100 : score; // normaliza se necessário
  if (s >= 0.85) return 'Alta';
  if (s >= 0.65) return 'Média';
  if (s >= 0.45) return 'Baixa';
  return 'Monitoramento';
}

export function getScoreConfig(
  score: number,
): { label: string; barColor: string; textColor: string } {
  if (score >= 0.85)
    return { label: 'Muito alta', barColor: 'bg-emerald-500', textColor: 'text-emerald-600 dark:text-emerald-400' };
  if (score >= 0.65)
    return { label: 'Alta', barColor: 'bg-blue-500', textColor: 'text-blue-600 dark:text-blue-400' };
  if (score >= 0.45)
    return { label: 'Média', barColor: 'bg-amber-500', textColor: 'text-amber-600 dark:text-amber-400' };
  if (score >= 0.25)
    return { label: 'Baixa', barColor: 'bg-orange-500', textColor: 'text-orange-600 dark:text-orange-400' };
  return { label: 'Muito baixa', barColor: 'bg-red-500', textColor: 'text-red-600 dark:text-red-400' };
}
