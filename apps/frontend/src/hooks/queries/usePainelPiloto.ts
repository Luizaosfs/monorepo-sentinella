import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import { STALE } from '@/lib/queryConfig';
import { useClienteAtivo } from '@/hooks/useClienteAtivo';
import type { PilotoFunilHoje, PilotoDespachoSupervisor, PilotoProdAgente } from '@/types/database';

/** Funil operacional do dia — view v_piloto_funil_hoje */
export function usePilotoFunil() {
  const { clienteId } = useClienteAtivo();
  return useQuery<PilotoFunilHoje | null>({
    queryKey: ['piloto-funil-hoje', clienteId],
    queryFn:  () => api.piloto.getFunilHoje(clienteId!),
    enabled:  !!clienteId,
    staleTime: STALE.SHORT,
    refetchInterval: 60_000,
  });
}

/** Despachos por supervisor — view v_piloto_despachos_supervisor */
export function usePilotoDespachosSupervisor() {
  const { clienteId } = useClienteAtivo();
  return useQuery<PilotoDespachoSupervisor[]>({
    queryKey: ['piloto-despachos-supervisor', clienteId],
    queryFn:  () => api.piloto.getDespachosSupervisor(clienteId!),
    enabled:  !!clienteId,
    staleTime: STALE.SHORT,
  });
}

/** Produtividade dos agentes em campo — view v_piloto_prod_agentes */
export function usePilotoProdAgentes() {
  const { clienteId } = useClienteAtivo();
  return useQuery<PilotoProdAgente[]>({
    queryKey: ['piloto-prod-agentes', clienteId],
    queryFn:  () => api.piloto.getProdAgentes(clienteId!),
    enabled:  !!clienteId,
    staleTime: STALE.SHORT,
  });
}
