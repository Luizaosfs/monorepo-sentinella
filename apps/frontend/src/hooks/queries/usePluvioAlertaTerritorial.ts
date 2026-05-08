import { useQuery } from '@tanstack/react-query';
import { pluvio } from '@/services/api/domains/pluvio';
import { STALE } from '@/lib/queryConfig';

export function usePluvioAlertaTerritorial(clienteId: string | null | undefined) {
  return useQuery({
    queryKey: ['pluvio-alerta-territorial', clienteId],
    queryFn: () => pluvio.getAlertaTerritorial(clienteId!),
    enabled: !!clienteId,
    staleTime: STALE.MODERATE,
  });
}
