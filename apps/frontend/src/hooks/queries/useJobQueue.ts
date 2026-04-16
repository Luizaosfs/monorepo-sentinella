import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { STALE } from '@/lib/queryConfig';
import type { JobTipo } from '@/types/database';

/** Lista jobs com filtros opcionais. Polling a cada 10s quando há jobs em execução. */
export function useJobQueue(filtros?: { status?: string; tipo?: JobTipo; limit?: number }) {
  return useQuery({
    queryKey: ['job-queue', filtros],
    queryFn: () => api.jobQueue.list(filtros),
    staleTime: STALE.SHORT,
    refetchInterval: (query) => {
      const jobs = query.state.data ?? [];
      const temAtivos = jobs.some(j => j.status === 'pendente' || j.status === 'em_execucao');
      return temAtivos ? 10_000 : false;
    },
  });
}

/** Retorna um job específico pelo id, com polling enquanto estiver ativo. */
export function useJob(id: string | null | undefined) {
  return useQuery({
    queryKey: ['job', id],
    queryFn: () => api.jobQueue.get(id!),
    enabled: !!id,
    staleTime: STALE.LIVE,
    refetchInterval: (query) => {
      const job = query.state.data;
      if (!job) return false;
      return job.status === 'pendente' || job.status === 'em_execucao' ? 5_000 : false;
    },
  });
}

export function useRetryJobMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.jobQueue.retry(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['job-queue'] }),
  });
}

export function useCancelJobMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.jobQueue.cancel(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['job-queue'] }),
  });
}

export function useEnqueueJobMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ tipo, payload }: { tipo: JobTipo; payload?: Record<string, unknown> }) =>
      api.jobQueue.enqueue(tipo, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['job-queue'] }),
  });
}
