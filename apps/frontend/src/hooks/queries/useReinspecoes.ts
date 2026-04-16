import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { STALE } from '@/lib/queryConfig';
import type { ReinspecaoTipo } from '@/types/database';

// ── Queries ───────────────────────────────────────────────────────────────────

/** Reinspeções de um foco específico (exibidas no GestorFocoDetalhe). */
export function useReinspecoesByFoco(focoRiscoId: string | null | undefined) {
  return useQuery({
    queryKey: ['reinspecoes', 'foco', focoRiscoId],
    queryFn: () => api.reinspecoes.listByFoco(focoRiscoId!),
    enabled: !!focoRiscoId,
    staleTime: STALE.SHORT,
  });
}

/** Reinspeções pendentes/vencidas do agente logado (AgenteHoje). */
export function useReinspecoesPendentesAgente(
  clienteId: string | null | undefined,
  agenteId: string | null | undefined,
) {
  return useQuery({
    queryKey: ['reinspecoes', 'agente', clienteId, agenteId],
    queryFn: () => api.reinspecoes.listPendentesAgente(clienteId!, agenteId!),
    enabled: !!clienteId && !!agenteId,
    staleTime: STALE.SHORT,
  });
}

/** Reinspeções vencidas do cliente (painel supervisor). */
export function useReinspecoesVencidasCliente(clienteId: string | null | undefined) {
  return useQuery({
    queryKey: ['reinspecoes', 'vencidas', clienteId],
    queryFn: () => api.reinspecoes.listVencidasCliente(clienteId!),
    enabled: !!clienteId,
    staleTime: STALE.SHORT,
  });
}

/** Contagem de reinspeções pendentes do agente (badge no menu). */
export function useCountReinspecoesPendentesAgente(
  clienteId: string | null | undefined,
  agenteId: string | null | undefined,
) {
  return useQuery({
    queryKey: ['reinspecoes', 'count', clienteId, agenteId],
    queryFn: () => api.reinspecoes.countPendentesAgente(clienteId!, agenteId!),
    enabled: !!clienteId && !!agenteId,
    staleTime: STALE.SHORT,
  });
}

// ── Mutations ─────────────────────────────────────────────────────────────────

/** Criar reinspeção manual. */
export function useCriarReinspecaoMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      focoRiscoId: string;
      tipo?: ReinspecaoTipo;
      dataPrevista: Date;
      responsavelId?: string;
      observacao?: string;
    }) => api.reinspecoes.criar(payload),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['reinspecoes', 'foco', variables.focoRiscoId] });
      qc.invalidateQueries({ queryKey: ['reinspecoes', 'agente'] });
      qc.invalidateQueries({ queryKey: ['reinspecoes', 'count'] });
    },
  });
}

/** Registrar resultado de reinspeção. */
export function useRegistrarResultadoReinspecaoMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      reinspecaoId: string;
      focoRiscoId: string;
      resultado: 'resolvido' | 'persiste' | 'nao_realizado';
      observacao?: string;
    }) => api.reinspecoes.registrarResultado(payload),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['reinspecoes', 'foco', variables.focoRiscoId] });
      qc.invalidateQueries({ queryKey: ['reinspecoes', 'agente'] });
      qc.invalidateQueries({ queryKey: ['reinspecoes', 'count'] });
      qc.invalidateQueries({ queryKey: ['focos-risco'] });
      qc.invalidateQueries({ queryKey: ['foco-risco', variables.focoRiscoId] });
    },
  });
}

/** Cancelar reinspeção. */
export function useCancelarReinspecaoMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ reinspecaoId, motivo }: { reinspecaoId: string; focoRiscoId: string; motivo?: string }) =>
      api.reinspecoes.cancelar(reinspecaoId, motivo),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['reinspecoes', 'foco', variables.focoRiscoId] });
      qc.invalidateQueries({ queryKey: ['reinspecoes', 'agente'] });
      qc.invalidateQueries({ queryKey: ['reinspecoes', 'count'] });
    },
  });
}

/** Reagendar reinspeção. */
export function useReagendarReinspecaoMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      reinspecaoId: string;
      focoRiscoId: string;
      novaData: Date;
      responsavelId?: string;
    }) => api.reinspecoes.reagendar(payload.reinspecaoId, payload.novaData, payload.responsavelId),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['reinspecoes', 'foco', variables.focoRiscoId] });
      qc.invalidateQueries({ queryKey: ['reinspecoes', 'agente'] });
    },
  });
}
