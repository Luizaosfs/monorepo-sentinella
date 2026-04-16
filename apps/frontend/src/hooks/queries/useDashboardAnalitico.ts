import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import { STALE } from '@/lib/queryConfig';
import { useClienteAtivo } from '@/hooks/useClienteAtivo';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface DashboardAnaliticoResumo {
  cliente_id: string;
  total_vistorias: number;
  p1_count: number;
  p2_count: number;
  p3_count: number;
  p4_count: number;
  visitados_count: number;
  sem_acesso_count: number;
  taxa_acesso_pct: number | null;
  alertas_urgentes: number;
  vulnerabilidade_alta_count: number;
  risco_vetorial_alto_count: number;
  risco_socio_alto_count: number;
}

export interface DashboardRiscoTerritorial {
  cliente_id: string;
  bairro: string;
  regiao_id: string | null;
  total_vistorias: number;
  criticos_count: number;
  risco_vetorial_alto: number;
  vulnerabilidade_alta: number;
  alertas_saude: number;
  alertas_urgentes: number;
  risco_socio_alto: number;
  sem_acesso_total: number;
  pct_criticos: number | null;
}

export interface DashboardVulnerabilidade {
  cliente_id: string;
  bairro: string;
  vulnerabilidade_domiciliar: string;
  total: number;
}

export interface DashboardAlertaSaude {
  cliente_id: string;
  bairro: string;
  alerta_saude: string;
  total: number;
}

export interface DashboardResultadoOperacional {
  cliente_id: string;
  bairro: string;
  resultado_operacional: string;
  total: number;
}

export interface DashboardImovelCritico {
  cliente_id: string;
  imovel_id: string;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string;
  regiao_id: string | null;
  vistoria_id: string;
  data_visita: string;
  prioridade_final: string | null;
  prioridade_motivo: string | null;
  resultado_operacional: string | null;
  vulnerabilidade_domiciliar: string | null;
  alerta_saude: string | null;
  risco_socioambiental: string | null;
  risco_vetorial: string | null;
  dimensoes_criticas_count: number;
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useResumoAnalitico() {
  const { clienteId } = useClienteAtivo();
  return useQuery<DashboardAnaliticoResumo | null>({
    queryKey: ['dashboard-analitico-resumo', clienteId],
    queryFn: () => api.dashboardAnalitico.getResumo(clienteId!),
    enabled: !!clienteId,
    staleTime: STALE.MEDIUM,
  });
}

export function useRiscoTerritorial(bairroFilter?: string) {
  const { clienteId } = useClienteAtivo();
  return useQuery<DashboardRiscoTerritorial[]>({
    queryKey: ['dashboard-analitico-risco-territorial', clienteId, bairroFilter],
    queryFn: () => api.dashboardAnalitico.getRiscoTerritorial(clienteId!, bairroFilter),
    enabled: !!clienteId,
    staleTime: STALE.MEDIUM,
  });
}

export function useVulnerabilidadeDistrib(bairroFilter?: string) {
  const { clienteId } = useClienteAtivo();
  return useQuery<DashboardVulnerabilidade[]>({
    queryKey: ['dashboard-analitico-vulnerabilidade', clienteId, bairroFilter],
    queryFn: () => api.dashboardAnalitico.getVulnerabilidade(clienteId!, bairroFilter),
    enabled: !!clienteId,
    staleTime: STALE.MEDIUM,
  });
}

export function useAlertaSaudeDistrib(bairroFilter?: string) {
  const { clienteId } = useClienteAtivo();
  return useQuery<DashboardAlertaSaude[]>({
    queryKey: ['dashboard-analitico-alerta-saude', clienteId, bairroFilter],
    queryFn: () => api.dashboardAnalitico.getAlertaSaude(clienteId!, bairroFilter),
    enabled: !!clienteId,
    staleTime: STALE.MEDIUM,
  });
}

export function useResultadoOperacionalDistrib(bairroFilter?: string) {
  const { clienteId } = useClienteAtivo();
  return useQuery<DashboardResultadoOperacional[]>({
    queryKey: ['dashboard-analitico-resultado-operacional', clienteId, bairroFilter],
    queryFn: () => api.dashboardAnalitico.getResultadoOperacional(clienteId!, bairroFilter),
    enabled: !!clienteId,
    staleTime: STALE.MEDIUM,
  });
}

export function useImoveisCriticos(bairroFilter?: string, prioridadeFilter?: string) {
  const { clienteId } = useClienteAtivo();
  return useQuery<DashboardImovelCritico[]>({
    queryKey: ['dashboard-analitico-imoveis-criticos', clienteId, bairroFilter, prioridadeFilter],
    queryFn: () => api.dashboardAnalitico.getImoveisCriticos(clienteId!, bairroFilter, prioridadeFilter),
    enabled: !!clienteId,
    staleTime: STALE.MEDIUM,
  });
}

export function useBairrosDashboard() {
  const { clienteId } = useClienteAtivo();
  return useQuery<string[]>({
    queryKey: ['dashboard-analitico-bairros', clienteId],
    queryFn: () => api.dashboardAnalitico.getBairros(clienteId!),
    enabled: !!clienteId,
    staleTime: STALE.LONG,
  });
}
