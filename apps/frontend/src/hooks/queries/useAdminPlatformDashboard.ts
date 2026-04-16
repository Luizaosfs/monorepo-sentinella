import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import { STALE } from '@/lib/queryConfig';

/** Snapshot para o painel do administrador da plataforma (cross-tenant). */
export function useAdminClientesResumo() {
  return useQuery({
    queryKey: ['admin-platform-clientes'],
    queryFn: () => api.clientes.listAll(),
    staleTime: STALE.MEDIUM,
  });
}

export function useAdminJobQueueResumo() {
  return useQuery({
    queryKey: ['admin-platform-job-queue'],
    queryFn: () => api.jobQueue.list({ limit: 50 }),
    staleTime: STALE.SHORT,
  });
}
