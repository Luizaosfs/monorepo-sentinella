import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { STALE } from '@/lib/queryConfig';
import type { BairroQuadra } from '@/types/database';

export function useQuadrasList(clienteId: string | null | undefined) {
  return useQuery({
    queryKey: ['quadras', clienteId],
    queryFn: () => api.quarteiroes.listByCliente(clienteId!) as Promise<BairroQuadra[]>,
    enabled: !!clienteId,
    staleTime: STALE.MEDIUM,
  });
}

export function useCriarQuadra() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { codigo: string; regiaoId?: string | null; ativo: boolean }) =>
      api.quarteiroes.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['quadras'] });
      qc.invalidateQueries({ queryKey: ['quarteiroes_mestre'] });
    },
  });
}

export function useSalvarQuadra() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: { id: string; codigo?: string; regiaoId?: string | null; ativo?: boolean; geojson?: Record<string, unknown> | null }) =>
      api.quarteiroes.save(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['quadras'] });
      qc.invalidateQueries({ queryKey: ['quarteiroes_mestre'] });
    },
  });
}

export function useRemoverQuadra() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.quarteiroes.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['quadras'] });
      qc.invalidateQueries({ queryKey: ['quarteiroes_mestre'] });
    },
  });
}

export function useBulkInsertQuadras() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rows: { codigo: string; regiaoId?: string }[]) =>
      api.quarteiroes.bulkInsert(rows),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['quadras'] });
      qc.invalidateQueries({ queryKey: ['quarteiroes_mestre'] });
    },
  });
}

export type GerarLoteResult = {
  totalSolicitado: number;
  totalCriado: number;
  totalIgnorado: number;
  criados: string[];
  ignorados: Array<{ codigo: string; motivo: string }>;
};

export function useDesenharQuarteirao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { regiaoId: string; codigo: string; geojson: Record<string, unknown> }) =>
      api.quarteiroes.desenharQuarteirao(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['quadras'] });
      qc.invalidateQueries({ queryKey: ['quarteiroes_mestre'] });
    },
  });
}

export function useAtualizarGeometriaQuarteirao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, geojson }: { id: string; geojson: Record<string, unknown> | null }) =>
      api.quarteiroes.atualizarGeometria(id, geojson),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['quadras'] });
      qc.invalidateQueries({ queryKey: ['quarteiroes_mestre'] });
    },
  });
}

export function useGerarLoteQuadras() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      regiaoId: string;
      prefixo: string;
      numeroInicial: number;
      numeroFinal: number;
    }): Promise<GerarLoteResult> => api.quarteiroes.gerarLote(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['quadras'] });
      qc.invalidateQueries({ queryKey: ['quarteiroes_mestre'] });
    },
  });
}

export function useImportarGeoJSONQuarteiroes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      features: Array<{ codigo: string; geojson: Record<string, unknown>; regiaoId?: string; bairro?: string; areaM2?: number }>;
    }) => api.quarteiroes.importarGeoJSON(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['quadras'] });
      qc.invalidateQueries({ queryKey: ['quarteiroes_mestre'] });
    },
  });
}

export type QuadraCandidataOSM = {
  codigo: string;
  areaM2: number;
  geojson: { type: 'Polygon'; coordinates: number[][][] };
};

export type GerarQuadrasOSMResult = {
  candidatos: QuadraCandidataOSM[];
  totalViasEncontradas: number;
};

export function useGerarQuadrasOSM() {
  return useMutation({
    mutationFn: (payload: {
      regiaoId: string;
      geojson: { type: 'Polygon'; coordinates: number[][][] };
      prefixo?: string;
      areaMinima?: number;
    }): Promise<GerarQuadrasOSMResult> => api.quarteiroes.gerarQuadrasOSM(payload),
  });
}
