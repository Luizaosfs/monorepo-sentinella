import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import { STALE } from '@/lib/queryConfig';

export const usePluvioRiscoByCliente = (clienteId: string | null) => {
  return useQuery({
    queryKey: ['pluvio_risco', clienteId],
    queryFn: () => api.pluvio.riscoByCliente(clienteId!),
    enabled: !!clienteId,
    staleTime: STALE.MODERATE,
  });
};

export const usePluvioOperacionalRun = (clienteId: string | null) => {
  return useQuery({
    queryKey: ['pluvio_operacional_run', clienteId],
    queryFn: () => api.pluvio.latestRunByCliente(clienteId!),
    enabled: !!clienteId,
    staleTime: STALE.MODERATE,
  });
};
