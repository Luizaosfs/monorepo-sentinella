/**
 * Hooks para as views analíticas regionais (P5 — analista_regional).
 * Consulta: v_regional_kpi_municipio, v_regional_sla_municipio, v_regional_uso_sistema
 *
 * Nota: as views filtram internamente pelo agrupamento do usuário logado (via auth.uid()).
 * Não é necessário passar agrupamento_id explicitamente — o banco resolve via RLS.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { STALE } from '@/lib/queryConfig';
import type { RegionalKpiMunicipio, RegionalSlaMunicipio, RegionalUsoSistema } from '@/types/database';

export function useRegionalKpi(enabled = true) {
  return useQuery<RegionalKpiMunicipio[]>({
    queryKey: ['regional-kpi'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_regional_kpi_municipio')
        .select('*')
        .order('total_focos', { ascending: false });
      if (error) throw error;
      return (data ?? []) as RegionalKpiMunicipio[];
    },
    enabled,
    staleTime: STALE.MEDIUM,
  });
}

export function useRegionalSla(enabled = true) {
  return useQuery<RegionalSlaMunicipio[]>({
    queryKey: ['regional-sla'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_regional_sla_municipio')
        .select('*')
        .order('sla_vencido', { ascending: false });
      if (error) throw error;
      return (data ?? []) as RegionalSlaMunicipio[];
    },
    enabled,
    staleTime: STALE.MEDIUM,
  });
}

export function useRegionalUso(enabled = true) {
  return useQuery<RegionalUsoSistema[]>({
    queryKey: ['regional-uso'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_regional_uso_sistema')
        .select('*')
        .order('eventos_7d', { ascending: false });
      if (error) throw error;
      return (data ?? []) as RegionalUsoSistema[];
    },
    enabled,
    staleTime: STALE.MEDIUM,
  });
}
