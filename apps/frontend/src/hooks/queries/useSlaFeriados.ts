import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { SlaFeriado } from '@/types/database';

/**
 * Lista feriados do cliente, ordenados por data.
 * Usado na tela de configuração de SLA (AdminSla) para gerenciar o calendário.
 */
export function useSlaFeriados(clienteId: string | null | undefined) {
  return useQuery({
    queryKey: ['sla_feriados', clienteId],
    queryFn: () => api.slaFeriados.listByCliente(clienteId!),
    enabled: !!clienteId,
    staleTime: 10 * 60 * 1000, // feriados mudam raramente — 10 min
  });
}

export function useSlaFeriadosMutations(clienteId: string | null | undefined) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['sla_feriados', clienteId] });

  const create = useMutation({
    mutationFn: (payload: Pick<SlaFeriado, 'cliente_id' | 'data' | 'descricao' | 'nacional'>) =>
      api.slaFeriados.create(payload),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.slaFeriados.remove(id),
    onSuccess: invalidate,
  });

  return { create, remove };
}
