import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import { STALE } from '@/lib/queryConfig';

export type AgenteSimples = { id: string; nome: string; email?: string; ativo?: boolean };

/**
 * Agentes de campo de um cliente.
 * Usa filtro server-side (papel=agente) — sem risco cross-tenant.
 * Nunca chama a API sem clienteId.
 */
export function useAgentes(clienteId: string | null | undefined) {
  return useQuery<AgenteSimples[]>({
    queryKey: ['agentes', clienteId],
    queryFn: async () => {
      const raw = await api.usuarios.listAgentes(clienteId!);
      return (raw as AgenteSimples[]).filter(Boolean);
    },
    enabled: !!clienteId,
    staleTime: STALE.STATIC,
  });
}
