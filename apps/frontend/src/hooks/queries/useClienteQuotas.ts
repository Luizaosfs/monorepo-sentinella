import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { ClienteQuota } from '@/types/database';
import { STALE } from '@/lib/queryConfig';
import { useAuth } from '@/hooks/useAuth';

/** Papéis com acesso a GET /billing/quotas e GET /billing/uso-mensal (ver billing.controller). */
function canReadClienteBillingQuotas(
  loading: boolean,
  isAdmin: boolean,
  isSupervisor: boolean,
  isAgente: boolean,
): boolean {
  if (loading) return false;
  return isAdmin || isSupervisor || isAgente;
}

/** Limites configurados + uso mensal corrente para o cliente. */
export function useClienteQuotas(clienteId: string | null | undefined) {
  const { loading: authLoading, isAdmin, isSupervisor, isAgente } = useAuth();
  const enabled =
    !!clienteId &&
    canReadClienteBillingQuotas(authLoading, isAdmin, isSupervisor, isAgente);

  const quotas = useQuery({
    queryKey: ['cliente_quotas', clienteId],
    queryFn: () => api.quotas.byCliente(clienteId!),
    enabled,
    staleTime: STALE.MODERATE,
  });

  const uso = useQuery({
    queryKey: ['cliente_uso_mensal', clienteId],
    queryFn: () => api.quotas.usoMensal(clienteId!),
    enabled,
    staleTime: STALE.RECENT,
    refetchInterval: enabled ? STALE.MODERATE : false,
  });

  return { quotas, uso };
}

/** Lista uso de todos os clientes (admin plataforma). */
export function useClienteQuotasAll() {
  const { loading: authLoading, isAdmin } = useAuth();
  return useQuery({
    queryKey: ['cliente_uso_mensal_all'],
    queryFn: () => api.quotas.usoMensalAll(),
    enabled: !authLoading && isAdmin,
    staleTime: STALE.RECENT,
  });
}

/** Mutation para atualizar limites (admin plataforma). */
export function useClienteQuotasMutation(clienteId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (limites: Partial<Pick<ClienteQuota, 'voos_mes' | 'levantamentos_mes' | 'itens_mes' | 'usuarios_ativos'>>) =>
      api.quotas.update(clienteId, limites),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cliente_quotas', clienteId] });
      qc.invalidateQueries({ queryKey: ['cliente_uso_mensal', clienteId] });
      qc.invalidateQueries({ queryKey: ['cliente_uso_mensal_all'] });
    },
  });
}
