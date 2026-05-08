import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { STALE } from '@/lib/queryConfig';
import { useClienteAtivo } from '@/hooks/useClienteAtivo';

export function useImplantacaoOperacionalStatus() {
  const { clienteId } = useClienteAtivo();
  return useQuery({
    queryKey: ['implantacao-operacional-status', clienteId],
    queryFn: () => api.implantacaoOperacional.getStatus(),
    enabled: !!clienteId,
    staleTime: STALE.SHORT,
  });
}

export function useIniciarImplantacaoOperacional() {
  const queryClient = useQueryClient();
  const { clienteId } = useClienteAtivo();
  return useMutation({
    mutationFn: () => api.implantacaoOperacional.iniciar(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['implantacao-operacional-status', clienteId] });
      queryClient.invalidateQueries({ queryKey: ['planejamentos'] });
    },
  });
}

export function useGerarOperacaoInicial() {
  const queryClient = useQueryClient();
  const { clienteId } = useClienteAtivo();
  return useMutation({
    mutationFn: () => api.implantacaoOperacional.gerarOperacaoInicial(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['implantacao-operacional-status', clienteId] });
      queryClient.invalidateQueries({ queryKey: ['planejamentos'] });
    },
  });
}
