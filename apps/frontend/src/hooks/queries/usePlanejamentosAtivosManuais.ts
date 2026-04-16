import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import { STALE } from '@/lib/queryConfig';

/** Planejamentos ativos com tipo_levantamento = MANUAL (para a aba Criar item). */
export const usePlanejamentosAtivosManuais = (clienteId: string | null) => {
  return useQuery({
    queryKey: ['planejamentos', 'ativos', 'manuais', clienteId],
    queryFn: () => api.planejamentos.listAtivosManuaisByCliente(clienteId!),
    enabled: !!clienteId,
    staleTime: STALE.MODERATE,
  });
};
