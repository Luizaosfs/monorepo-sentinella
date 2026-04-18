/**
 * Hooks para as views analíticas regionais (P5 — analista_regional).
 * Endpoints NestJS analytics pendentes — retornam vazio até implementação.
 */
import { useQuery } from '@tanstack/react-query';
import { http } from '@sentinella/api-client';
import { STALE } from '@/lib/queryConfig';
import type { RegionalKpiMunicipio, RegionalSlaMunicipio, RegionalUsoSistema } from '@/types/database';

export function useRegionalKpi(enabled = true) {
  return useQuery<RegionalKpiMunicipio[]>({
    queryKey: ['regional-kpi'],
    queryFn: async () => {
      try {
        return await http.get('/analytics/regional/kpi') as RegionalKpiMunicipio[];
      } catch {
        return [];
      }
    },
    enabled,
    staleTime: STALE.MEDIUM,
  });
}

export function useRegionalSla(enabled = true) {
  return useQuery<RegionalSlaMunicipio[]>({
    queryKey: ['regional-sla'],
    queryFn: async () => {
      try {
        return await http.get('/analytics/regional/sla') as RegionalSlaMunicipio[];
      } catch {
        return [];
      }
    },
    enabled,
    staleTime: STALE.MEDIUM,
  });
}

export function useRegionalUso(enabled = true) {
  return useQuery<RegionalUsoSistema[]>({
    queryKey: ['regional-uso'],
    queryFn: async () => {
      try {
        return await http.get('/analytics/regional/uso') as RegionalUsoSistema[];
      } catch {
        return [];
      }
    },
    enabled,
    staleTime: STALE.MEDIUM,
  });
}
