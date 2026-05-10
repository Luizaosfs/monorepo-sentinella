import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import { STALE } from '@/lib/queryConfig';

/**
 * Distribuição completa de quarteirões de um ciclo (visão admin).
 */
export function useDistribuicaoQuarteiraoByCiclo(
  clienteId: string | null | undefined,
  cicloId: string | null | undefined,
) {
  return useQuery({
    queryKey: ['dist_quarteirao', clienteId, cicloId],
    queryFn: () => api.distribuicaoQuarteirao.listByCiclo(clienteId!, cicloId!),
    enabled: !!clienteId && !!cicloId,
    staleTime: STALE.MEDIUM,
  });
}

/**
 * Quarteirões atribuídos a um agente específico num ciclo (visão agente).
 * Retorna array de strings com os códigos dos quarteirões.
 */
export function useQuarteiroesByAgente(
  clienteId: string | null | undefined,
  agenteId: string | null | undefined,
  cicloId: string | null | undefined,
) {
  return useQuery<string[]>({
    queryKey: ['distribuicao_quarteirao_agente', clienteId, agenteId, cicloId],
    queryFn: () => api.distribuicaoQuarteirao.listByAgente(clienteId!, agenteId!, cicloId!),
    enabled: !!clienteId && !!agenteId && !!cicloId,
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
  cicloId: string | null | undefined,
) {
  return useQuery({
    queryKey: ['cobertura_quarteirao', clienteId, cicloId],
    queryFn: () => api.distribuicaoQuarteirao.coberturaByCliente(clienteId!, cicloId!),
    enabled: !!clienteId && !!cicloId,
    staleTime: STALE.SHORT,
  });
}
