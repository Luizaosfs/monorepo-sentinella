import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { STALE } from '@/lib/queryConfig';
import { toast } from 'sonner';
import { handleQuotaError } from '@/lib/quotaErrorHandler';

export function useAnaliseIa(levantamentoId: string | null | undefined) {
  return useQuery({
    queryKey: ['analise_ia', levantamentoId],
    queryFn: () => api.analiseIa.getByLevantamento(levantamentoId!),
    enabled: !!levantamentoId,
    staleTime: STALE.MODERATE,
  });
}

/**
 * Enfileira a triagem IA (QW-13 — execução assíncrona).
 * Retorna { job_id } imediatamente. O resultado aparece em useAnaliseIa
 * assim que o worker concluir (polling via refetchInterval).
 */
export function useTriagemIaMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ levantamentoId, clienteId }: { levantamentoId: string; clienteId: string }) => {
      // QW-16 B5: verificar quota de IA antes de enfileirar o job
      const quota = await api.quotas.verificar(clienteId, 'ia_calls_mes');
      if (!quota.ok) {
        throw Object.assign(
          new Error('quota_ia_excedida: limite de triagens IA do mês atingido'),
          { code: 'P0001' },
        );
      }
      return api.analiseIa.triggerTriagem(levantamentoId, clienteId);
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['analise_ia', variables.levantamentoId] });
      qc.invalidateQueries({ queryKey: ['job-queue'] });
    },
    onError: (err) => {
      if (handleQuotaError(err)) return;
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('quota_ia_excedida')) {
        toast.error('Limite de triagens IA do mês atingido.', {
          description: 'O levantamento foi salvo. A análise automática não será executada. Contate o administrador da plataforma.',
          duration: 7000,
        });
      }
    },
  });
}
