import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import { STALE } from '@/lib/queryConfig';
import { useClienteAtivo } from '@/hooks/useClienteAtivo';
import { PRIORIDADE_SLA_INT, type SlaInteligenteStatus } from '@/lib/slaInteligenteVisual';

type SlaInteligenteItem = Awaited<ReturnType<typeof api.slaInteligente.listByCliente>>[number];

function sortPorPrioridade(list: SlaInteligenteItem[]): SlaInteligenteItem[] {
  return [...list].sort((a, b) => {
    const pa = PRIORIDADE_SLA_INT[(a.status_sla_inteligente ?? 'sem_prazo') as SlaInteligenteStatus] ?? 5;
    const pb = PRIORIDADE_SLA_INT[(b.status_sla_inteligente ?? 'sem_prazo') as SlaInteligenteStatus] ?? 5;
    if (pa !== pb) return pa - pb;
    return (b.tempo_em_estado_atual_min ?? 0) - (a.tempo_em_estado_atual_min ?? 0);
  });
}

export function useSlaInteligente() {
  const { clienteId } = useClienteAtivo();
  return useQuery({
    queryKey: ['sla-inteligente', clienteId],
    queryFn: async () => {
      const data = await api.slaInteligente.listByCliente(clienteId!);
      return sortPorPrioridade(data);
    },
    enabled: !!clienteId,
    staleTime: STALE.SHORT,
  });
}

export function useSlaInteligenteCriticos() {
  const { clienteId } = useClienteAtivo();
  return useQuery({
    queryKey: ['sla-inteligente-criticos', clienteId],
    queryFn: async () => {
      const data = await api.slaInteligente.listCriticos(clienteId!);
      return sortPorPrioridade(data);
    },
    enabled: !!clienteId,
    staleTime: STALE.SHORT,
  });
}

export function useSlaInteligenteByFoco(focoId: string | null | undefined) {
  return useQuery({
    queryKey: ['sla-inteligente-foco', focoId],
    queryFn: () => api.slaInteligente.getByFocoId(focoId!),
    enabled: !!focoId,
    staleTime: STALE.SHORT,
  });
}
