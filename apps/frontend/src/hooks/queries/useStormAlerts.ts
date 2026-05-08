import { useQuery } from '@tanstack/react-query';
import { pluvio } from '@/services/api/domains/pluvio';
import { STALE } from '@/lib/queryConfig';

export interface WeatherAlert {
  regiao: string;
  type: string;
  severity: 'moderado' | 'alto' | 'critico';
  message: string;
  day: string;
}

export const useStormAlerts = (clienteId: string | null) => {
  return useQuery<WeatherAlert[]>({
    queryKey: ['storm-forecast', clienteId],
    queryFn: async () => {
      const data = await pluvio.getStormForecast(clienteId!);
      return data.map(({ regiao, type, severity, message, day }) => ({
        regiao,
        type,
        severity,
        message,
        day,
      }));
    },
    enabled: !!clienteId,
    staleTime: STALE.MODERATE,
  });
};
