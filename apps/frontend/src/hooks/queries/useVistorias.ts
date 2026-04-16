import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { StatusVistoria, Vistoria, VistoriaDeposito, VistoriaSintomas, VistoriaRiscos } from '@/types/database';
import { STALE } from '@/lib/queryConfig';
import { useRealtimeInvalidator } from '@/hooks/useRealtimeInvalidator';
import { handleQuotaError } from '@/lib/quotaErrorHandler';
import { captureError } from '@/lib/sentry';

export type FiltrosConsolidacao = {
  prioridade?: Array<'P1' | 'P2' | 'P3' | 'P4' | 'P5'>;
  alerta_saude?: 'nenhum' | 'atencao' | 'urgente' | 'inconclusivo';
  risco_vetorial?: 'baixo' | 'medio' | 'alto' | 'critico' | 'inconclusivo';
  consolidacao_incompleta?: boolean;
};

export function useVistorias(
  clienteId: string | null | undefined,
  agenteId: string | null | undefined,
  ciclo?: number,
) {
  useRealtimeInvalidator({
    table: 'vistorias',
    filter: clienteId ? `cliente_id=eq.${clienteId}` : undefined,
    queryKeys: [
      ['vistorias', clienteId, agenteId],
      ['vistoria_resumo', clienteId, agenteId],
    ],
    enabled: !!clienteId,
  });

  return useQuery({
    queryKey: ['vistorias', clienteId, agenteId, ciclo ?? null],
    queryFn: () => api.vistorias.listByAgente(clienteId!, agenteId!, ciclo),
    enabled: !!clienteId && !!agenteId,
    staleTime: STALE.SHORT,
  });
}

export function useVistoriasByImovel(
  imovelId: string | null | undefined,
  clienteId: string | null | undefined,
) {
  return useQuery({
    queryKey: ['vistorias_imovel', imovelId, clienteId ?? null],
    queryFn: () => api.vistorias.listByImovel(imovelId!, clienteId!),
    enabled: !!imovelId && !!clienteId,
    staleTime: STALE.SHORT,
  });
}

export function useVistoriaResumo(
  clienteId: string | null | undefined,
  agenteId: string | null | undefined,
  ciclo: number,
) {
  return useQuery({
    queryKey: ['vistoria_resumo', clienteId, agenteId, ciclo],
    queryFn: () => api.vistorias.getResumoAgente(clienteId!, agenteId!, ciclo),
    enabled: !!clienteId && !!agenteId,
    staleTime: STALE.SHORT,
  });
}

export function useCreateVistoriaMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.vistorias.create,
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['vistorias', variables.cliente_id] });
      qc.invalidateQueries({ queryKey: ['vistoria_resumo', variables.cliente_id] });
    },
    onError: (err: unknown) => {
      if (!handleQuotaError(err)) {
        captureError(err, { mutation: 'useCreateVistoriaMutation' });
      }
    },
  });
}

export function useUpdateVistoriaStatusMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: StatusVistoria }) =>
      api.vistorias.updateStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vistorias'] });
      qc.invalidateQueries({ queryKey: ['vistoria_resumo'] });
    },
  });
}

export function useAddDepositoMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ vistoriaId, deposito }: { vistoriaId: string; deposito: Omit<VistoriaDeposito, 'id' | 'created_at'> }) =>
      api.vistorias.addDeposito(vistoriaId, deposito),
    onSuccess: (_data, _variables) => {
      qc.invalidateQueries({ queryKey: ['vistorias_imovel'] });
      qc.invalidateQueries({ queryKey: ['vistorias'] });
    },
    onError: (err: unknown) => {
      if (!handleQuotaError(err)) {
        captureError(err, { mutation: 'useAddDepositoMutation' });
      }
    },
  });
}

export function useAddSintomasMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sintomas: Omit<VistoriaSintomas, 'id' | 'created_at' | 'gerou_caso_notificado_id'>) =>
      api.vistorias.addSintomas(sintomas),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['casos_notificados'] });
    },
    onError: (err: unknown) => {
      if (!handleQuotaError(err)) {
        captureError(err, { mutation: 'useAddSintomasMutation' });
      }
    },
  });
}

export function useAddRiscosMutation() {
  return useMutation({
    mutationFn: (riscos: Omit<VistoriaRiscos, 'id' | 'created_at'>) =>
      api.vistorias.addRiscos(riscos),
    onError: (err: unknown) => {
      if (!handleQuotaError(err)) {
        captureError(err, { mutation: 'useAddRiscosMutation' });
      }
    },
  });
}

/** Hook para listas operacionais do gestor/supervisor — vistorias com consolidação. */
export function useVistoriasConsolidadas(
  clienteId: string | null | undefined,
  filtros?: FiltrosConsolidacao,
) {
  return useQuery({
    queryKey: ['vistorias_consolidadas', clienteId, filtros ?? null],
    queryFn: () => api.vistorias.listConsolidadas(clienteId!, filtros),
    enabled: !!clienteId,
    staleTime: STALE.MEDIUM,
  });
}
