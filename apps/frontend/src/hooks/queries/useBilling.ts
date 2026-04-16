// QW-15 — Hooks de billing, planos e snapshots de uso
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { ClientePlano } from '@/types/database';
import { STALE } from '@/lib/queryConfig';

/** Catálogo de planos (leitura pública, cache longo). */
export function usePlanos() {
  return useQuery({
    queryKey: ['planos'],
    queryFn: () => api.billing.listPlanos(),
    staleTime: STALE.STATIC,
  });
}

/** Plano contratado do cliente com dados do plano base. */
export function useClientePlano(clienteId: string | null | undefined) {
  return useQuery({
    queryKey: ['cliente_plano', clienteId],
    queryFn: () => api.billing.getClientePlano(clienteId!),
    enabled: !!clienteId,
    staleTime: STALE.LONG,
  });
}

/** Resumo de billing de todos os clientes — admin plataforma. */
export function useBillingResumo() {
  return useQuery({
    queryKey: ['billing_resumo'],
    queryFn: () => api.billing.listResumo(),
    staleTime: STALE.MEDIUM,
  });
}

/** Histórico de snapshots mensais de um cliente (até 12 meses). */
export function useBillingSnapshots(clienteId: string | null | undefined) {
  return useQuery({
    queryKey: ['billing_snapshots', clienteId],
    queryFn: () => api.billing.listSnapshots(clienteId!),
    enabled: !!clienteId,
    staleTime: STALE.LONG,
  });
}

/** Snapshot mais recente de um cliente. */
export function useUltimoSnapshot(clienteId: string | null | undefined) {
  return useQuery({
    queryKey: ['billing_ultimo_snapshot', clienteId],
    queryFn: () => api.billing.getUltimoSnapshot(clienteId!),
    enabled: !!clienteId,
    staleTime: STALE.MEDIUM,
  });
}

/** Ciclos de faturamento de um cliente. */
export function useBillingCiclos(clienteId: string | null | undefined) {
  return useQuery({
    queryKey: ['billing_ciclos', clienteId],
    queryFn: () => api.billing.listCiclos(clienteId!),
    enabled: !!clienteId,
    staleTime: STALE.LONG,
  });
}

/** Mutation para atualizar plano do cliente (admin plataforma). */
export function useUpdateClientePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ clienteId, payload }: {
      clienteId: string;
      payload: Partial<Pick<ClientePlano, 'plano_id' | 'status' | 'contrato_ref' | 'data_fim' | 'observacao' | 'limites_personalizados'>>;
    }) => api.billing.updateClientePlano(clienteId, payload),
    onSuccess: (_data, { clienteId }) => {
      qc.invalidateQueries({ queryKey: ['cliente_plano', clienteId] });
      qc.invalidateQueries({ queryKey: ['billing_resumo'] });
    },
  });
}

/** Mutation para disparar snapshot manual de um cliente. */
export function useTriggerBillingSnapshot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (clienteId: string) => api.billing.triggerSnapshot(clienteId),
    onSuccess: (_data, clienteId) => {
      qc.invalidateQueries({ queryKey: ['billing_snapshots', clienteId] });
      qc.invalidateQueries({ queryKey: ['billing_ultimo_snapshot', clienteId] });
      qc.invalidateQueries({ queryKey: ['billing_resumo'] });
    },
  });
}
