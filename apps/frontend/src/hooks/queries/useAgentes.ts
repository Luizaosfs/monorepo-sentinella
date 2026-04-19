import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import { STALE } from '@/lib/queryConfig';
import type { UsuarioComPapel } from '@/services/api';

/**
 * Lista agentes de um cliente para seleção de responsável.
 */
export function useAgentes(
  clienteId: string | null | undefined,
): { data: UsuarioComPapel[]; isLoading: boolean } {
  const { data, isLoading } = useQuery({
    queryKey: ['agentes', clienteId],
    queryFn: () => api.usuarios.listAgentes(clienteId!),
    enabled: !!clienteId,
    staleTime: STALE.LONG,
  });

  return { data: data ?? [], isLoading };
}
