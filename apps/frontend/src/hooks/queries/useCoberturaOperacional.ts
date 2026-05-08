import { useQuery } from '@tanstack/react-query';

import { useClienteAtivo } from '@/hooks/useClienteAtivo';
import { STALE } from '@/lib/queryConfig';
import { api } from '@/services/api';

export function useResumoCoberturaOperacional() {
  const { clienteId } = useClienteAtivo();
  return useQuery({
    queryKey: ['cobertura-resumo', clienteId],
    queryFn: () => api.coberturaOperacional.getResumo(),
    enabled: !!clienteId,
    staleTime: STALE.MEDIUM,
  });
}

export function useCoberturaQuarteiroes() {
  const { clienteId } = useClienteAtivo();
  return useQuery({
    queryKey: ['cobertura-quarteiroes', clienteId],
    queryFn: () => api.coberturaOperacional.getQuarteiroes(),
    enabled: !!clienteId,
    staleTime: STALE.MEDIUM,
  });
}

export function useCoberturaAgentes() {
  const { clienteId } = useClienteAtivo();
  return useQuery({
    queryKey: ['cobertura-agentes', clienteId],
    queryFn: () => api.coberturaOperacional.getAgentes(),
    enabled: !!clienteId,
    staleTime: STALE.MEDIUM,
  });
}

export function useImoveisNuncaVisitados() {
  const { clienteId } = useClienteAtivo();
  return useQuery({
    queryKey: ['cobertura-imoveis-nunca-visitados', clienteId],
    queryFn: () => api.coberturaOperacional.getImoveisNuncaVisitados(),
    enabled: !!clienteId,
    staleTime: STALE.MEDIUM,
  });
}
