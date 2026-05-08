import { useQuery } from '@tanstack/react-query';

import { useClienteAtivo } from '@/hooks/useClienteAtivo';
import { STALE } from '@/lib/queryConfig';
import { api } from '@/services/api';
import type { PeriodoFilter } from '@/services/api/domains/reincidencia-territorial';

export function useResumoReincidencia(filtro?: PeriodoFilter) {
  const { clienteId } = useClienteAtivo();
  return useQuery({
    queryKey: ['reincidencia-resumo', clienteId, filtro],
    queryFn: () => api.reincidenciaTerritorial.getResumo(filtro),
    enabled: !!clienteId,
    staleTime: STALE.MEDIUM,
  });
}

export function useReincidenciaImoveis(filtro?: PeriodoFilter) {
  const { clienteId } = useClienteAtivo();
  return useQuery({
    queryKey: ['reincidencia-imoveis', clienteId, filtro],
    queryFn: () => api.reincidenciaTerritorial.getImoveis(filtro),
    enabled: !!clienteId,
    staleTime: STALE.MEDIUM,
  });
}

export function useReincidenciaQuarteiroes(filtro?: PeriodoFilter) {
  const { clienteId } = useClienteAtivo();
  return useQuery({
    queryKey: ['reincidencia-quarteiroes', clienteId, filtro],
    queryFn: () => api.reincidenciaTerritorial.getQuarteiroes(filtro),
    enabled: !!clienteId,
    staleTime: STALE.MEDIUM,
  });
}

export function useReincidenciaBairros(filtro?: PeriodoFilter) {
  const { clienteId } = useClienteAtivo();
  return useQuery({
    queryKey: ['reincidencia-bairros', clienteId, filtro],
    queryFn: () => api.reincidenciaTerritorial.getBairros(filtro),
    enabled: !!clienteId,
    staleTime: STALE.MEDIUM,
  });
}
