/**
 * Hooks para as views analíticas regionais (P5 — analista_regional).
 * Endpoints NestJS analytics pendentes — retornam vazio até implementação.
 */
import { useQuery } from '@tanstack/react-query';
import { http } from '@sentinella/api-client';
import { STALE } from '@/lib/queryConfig';
import type { RegionalComparativoResponse, RegionalEvolucaoItem, RegionalKpiMunicipio, RegionalMunicipioDetalhe, RegionalResumoMunicipio, RegionalSlaMunicipio, RegionalUsoSistema, RegionalVulnerabilidadeMunicipio } from '@/types/database';

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

export function useRegionalResumo(enabled = true) {
  return useQuery<RegionalResumoMunicipio[]>({
    queryKey: ['regional-resumo'],
    queryFn: async () => {
      try {
        return await http.get('/analytics/regional/resumo') as RegionalResumoMunicipio[];
      } catch {
        return [];
      }
    },
    enabled,
    staleTime: STALE.MEDIUM,
  });
}

export function useRegionalVulnerabilidade(enabled = true) {
  return useQuery<RegionalVulnerabilidadeMunicipio[]>({
    queryKey: ['regional-vulnerabilidade'],
    queryFn: async () => {
      try {
        return await http.get('/analytics/regional/vulnerabilidade') as RegionalVulnerabilidadeMunicipio[];
      } catch {
        return [];
      }
    },
    enabled,
    staleTime: STALE.MEDIUM,
  });
}

export function useRegionalEvolucao(
  params?: { dataInicio?: string; dataFim?: string },
  enabled = true,
) {
  const qs = params
    ? new URLSearchParams(
        Object.fromEntries(
          Object.entries(params).filter(([, v]) => v !== undefined) as [string, string][],
        ),
      ).toString()
    : '';

  return useQuery<RegionalEvolucaoItem[]>({
    queryKey: ['regional-evolucao', params?.dataInicio, params?.dataFim],
    queryFn: async () => {
      try {
        const path = qs ? `/analytics/regional/evolucao?${qs}` : '/analytics/regional/evolucao';
        return await http.get(path) as RegionalEvolucaoItem[];
      } catch {
        return [];
      }
    },
    enabled,
    staleTime: STALE.MEDIUM,
  });
}

export function useRegionalComparativo(
  params?: { dataInicio?: string; dataFim?: string },
  enabled = true,
) {
  const qs = params
    ? new URLSearchParams(
        Object.fromEntries(
          Object.entries(params).filter(([, v]) => v !== undefined) as [string, string][],
        ),
      ).toString()
    : '';

  return useQuery<RegionalComparativoResponse | null>({
    queryKey: ['regional-comparativo', params?.dataInicio, params?.dataFim],
    queryFn: async () => {
      try {
        const path = qs ? `/analytics/regional/comparativo?${qs}` : '/analytics/regional/comparativo';
        return await http.get(path) as RegionalComparativoResponse;
      } catch {
        return null;
      }
    },
    enabled,
    staleTime: STALE.MEDIUM,
  });
}

export function useRegionalMunicipioDetalhe(clienteId?: string, enabled = true) {
  return useQuery<RegionalMunicipioDetalhe>({
    queryKey: ['regional-municipio-detalhe', clienteId],
    queryFn: () => http.get(`/analytics/regional/municipio/${clienteId}`) as Promise<RegionalMunicipioDetalhe>,
    enabled: enabled && !!clienteId,
    staleTime: STALE.MEDIUM,
    retry: 1,
  });
}
