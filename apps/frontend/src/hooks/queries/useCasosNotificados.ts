import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import { CasoNotificado, StatusCaso } from '@/types/database';
import { STALE } from '@/lib/queryConfig';
import { useRealtimeInvalidator } from '@/hooks/useRealtimeInvalidator';

export function useCasosNotificados(clienteId: string | null | undefined) {
  useRealtimeInvalidator({
    table: 'casos_notificados',
    filter: clienteId ? `cliente_id=eq.${clienteId}` : undefined,
    queryKeys: [['casos_notificados', clienteId]],
    enabled: !!clienteId,
  });

  return useQuery({
    queryKey: ['casos_notificados', clienteId],
    queryFn: () => api.casosNotificados.list(clienteId!),
    enabled: !!clienteId,
    staleTime: STALE.SHORT, // 2 min — casos podem chegar a qualquer momento
  });
}

export function useCasosNotificadosMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.casosNotificados.create,
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['casos_notificados', variables.cliente_id] });
      qc.invalidateQueries({ queryKey: ['casos_widget'] });
    },
  });
}

export function useUpdateStatusCasoMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: StatusCaso }) =>
      api.casosNotificados.updateStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['casos_notificados'] });
      qc.invalidateQueries({ queryKey: ['casos_widget'] });
    },
  });
}

/** Count de casos cruzados para um item específico — usado no ItemDetailPanel. */
export function useCasosProximosAoItem(itemId: string | null | undefined) {
  return useQuery({
    queryKey: ['casos_proximos_item', itemId],
    queryFn: () => api.casosNotificados.countProximoAoItem(itemId!),
    enabled: !!itemId,
    staleTime: STALE.SHORT,
  });
}

/** Detalhe dos cruzamentos (com doença e distância) de um item — expansão no painel. */
export function useCruzamentosDoItem(itemId: string | null | undefined) {
  return useQuery({
    queryKey: ['cruzamentos_item', itemId],
    queryFn: () => api.casosNotificados.cruzamentosDoItem(itemId!),
    enabled: !!itemId,
    staleTime: STALE.SHORT,
  });
}

/** Cruzamentos de um caso específico — exibido na tela de sucesso do notificador. */
export function useCruzamentosDoCaso(casoId: string | null | undefined) {
  return useQuery({
    queryKey: ['cruzamentos_caso', casoId],
    queryFn: () => api.casosNotificados.cruzamentosDoCaso(casoId!),
    enabled: !!casoId,
    staleTime: STALE.SHORT,
  });
}

/** Conta cruzamentos caso↔foco criados hoje — para Central Operacional. */
export function useCasosCruzadosHoje() {
  return useQuery({
    queryKey: ['casos_cruzados_hoje'],
    queryFn: () => api.casosNotificados.countCruzadosHoje(),
    staleTime: STALE.SHORT,
    refetchInterval: 60_000,
  });
}

export function useUpdateCasoMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<CasoNotificado> }) =>
      api.casosNotificados.update(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['casos_notificados'] });
      qc.invalidateQueries({ queryKey: ['casos_widget'] });
    },
  });
}

/**
 * QW-17C — Cursor pagination (keyset) para AdminCasosNotificados.
 * Usa useInfiniteQuery: cada página carrega PAGE_LIMIT registros via RPC.
 * Retorna { allCasos, fetchNextPage, hasNextPage, isFetchingNextPage }.
 */
const PAGE_LIMIT = 100;

const EMPTY_CASOS: CasoNotificado[] = [];

export function useCasosNotificadosPaginados(clienteId: string | null | undefined) {
  const query = useInfiniteQuery({
    queryKey: ['casos_notificados_paginados', clienteId],
    queryFn: ({ pageParam }) => {
      const cursor = pageParam as { created_at: string; id: string } | undefined;
      return api.casosNotificados.listPaginado(clienteId!, {
        limit: PAGE_LIMIT,
        cursorCreated: cursor?.created_at,
        cursorId: cursor?.id,
      });
    },
    initialPageParam: undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: !!clienteId,
    staleTime: STALE.SHORT,
  });

  const pagesLen = query.data?.pages?.length ?? 0;
  const allCasos = useMemo(() => {
    if (!query.data?.pages?.length) return EMPTY_CASOS;
    return query.data.pages.flatMap((p) => p.data);
  }, [query.dataUpdatedAt, pagesLen]);

  return { ...query, allCasos };
}

/**
 * Retorna um Set com todos os `levantamento_item_id` que possuem cruzamento
 * com caso notificado para o cliente — usado para badge "Caso próximo" na lista
 * de focos e no mapa do supervisor. Uma query, sem N+1.
 */
export function useFocosComCruzamentos(clienteId: string | null | undefined) {
  return useQuery({
    queryKey: ['focos_com_cruzamentos', clienteId],
    queryFn: async () => {
      const rows = await api.casosNotificados.listCruzamentos(clienteId!);
      return new Set(rows.map((r) => r.levantamento_item_id).filter(Boolean));
    },
    enabled: !!clienteId,
    staleTime: STALE.SHORT,
  });
}

/** Casos num raio em torno de um ponto — para o mapa e sugestão de planejamento. */
export function useCasosProximosAoPonto(
  lat: number | null | undefined,
  lng: number | null | undefined,
  clienteId: string | null | undefined,
  raioMetros = 300,
) {
  return useQuery({
    queryKey: ['casos_ponto', clienteId, lat, lng, raioMetros],
    queryFn: () => api.casosNotificados.listProximosAoPonto(lat!, lng!, clienteId!, raioMetros),
    enabled: lat != null && lng != null && !!clienteId,
    staleTime: STALE.SHORT,
  });
}
