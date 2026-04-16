import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import { STALE } from '@/lib/queryConfig';

export function useOperacoesComVinculos(clienteId: string | null | undefined) {
  return useQuery({
    queryKey: ['operacoes_com_vinculos', clienteId],
    queryFn: () => api.operacoes.listarComVinculos(clienteId!),
    enabled: !!clienteId,
    staleTime: STALE.SHORT,
  });
}
