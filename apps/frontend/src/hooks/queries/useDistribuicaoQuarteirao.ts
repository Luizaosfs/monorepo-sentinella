import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import { STALE } from '@/lib/queryConfig';

/**
 * Distribuição completa de quarteirões de um ciclo (visão admin).
 */
export function useDistribuicaoQuarteiraoByCiclo(
  clienteId: string | null | undefined,
  ciclo: number,
) {
  return useQuery({
    queryKey: ['dist_quarteirao', clienteId, ciclo],
    queryFn: () => api.distribuicaoQuarteirao.listByCiclo(clienteId!, ciclo),
    enabled: !!clienteId,
    staleTime: STALE.MEDIUM,
  });
}

/**
 * Quarteirões atribuídos a um agente específico num ciclo (visão operador).
 * Retorna array de strings com os códigos dos quarteirões.
 */
export function useQuarteiroesByAgente(
  clienteId: string | null | undefined,
  agenteId: string | null | undefined,
  ciclo: number,
) {
  return useQuery<string[]>({
    queryKey: ['distribuicao_quarteirao_agente', clienteId, agenteId, ciclo],
    queryFn: () => api.distribuicaoQuarteirao.listByAgente(clienteId!, agenteId!, ciclo),
    enabled: !!clienteId && !!agenteId,
    staleTime: STALE.LONG,
  });
}

/**
 * Tabela mestre de quarteirões do cliente.
 */
export function useQuarteiroesMestre(clienteId: string | null | undefined) {
  return useQuery({
    queryKey: ['quarteiroes_mestre', clienteId],
    queryFn: () => api.quarteiroes.listByCliente(clienteId!),
    enabled: !!clienteId,
    staleTime: STALE.LONG,
  });
}

/**
 * Relatório de cobertura de quarteirões por ciclo.
 */
export function useCoberturaQuarteirao(
  clienteId: string | null | undefined,
  ciclo: number,
) {
  return useQuery({
    queryKey: ['cobertura_quarteirao', clienteId, ciclo],
    queryFn: () => api.distribuicaoQuarteirao.coberturaByCliente(clienteId!, ciclo),
    enabled: !!clienteId,
    staleTime: STALE.SHORT,
  });
}
