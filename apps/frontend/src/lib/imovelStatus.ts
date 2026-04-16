/**
 * imovelStatus — lógica canônica de status de imóvel para o agente.
 *
 * Prioridade:
 *  1. focos_ativos > 0            → pendente  (foco sobrepõe visita)
 *  2. ultima_visita === hoje       → visitado
 *  3. tentativas_sem_acesso > 0   → revisita
 *  4. default                     → pendente
 */
import type { ImovelResumo } from '@/types/database';

export type StatusImovelKey = 'visitado' | 'pendente' | 'revisita' | 'fechado';

export function resolveStatusImovel(
  im: Pick<ImovelResumo, 'focos_ativos' | 'ultima_visita' | 'tentativas_sem_acesso' | 'total_vistorias'>,
  hoje: string,
): StatusImovelKey {
  if (im.focos_ativos > 0) return 'pendente';
  if (im.ultima_visita?.slice(0, 10) === hoje) return 'visitado';
  if (im.tentativas_sem_acesso > 0 && im.total_vistorias > 0) return 'revisita';
  return 'pendente';
}
