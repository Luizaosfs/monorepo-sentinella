import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import { STALE } from '@/lib/queryConfig';

export interface WeatherAlert {
  regiao: string;
  type: string;
  severity: 'moderado' | 'alto' | 'critico';
  message: string;
  day: string;
}

function classifySeverity(mm: number): 'moderado' | 'alto' | 'critico' {
  if (mm >= 50) return 'critico';
  if (mm >= 20) return 'alto';
  return 'moderado';
}

async function fetchStormAlerts(clienteId: string): Promise<WeatherAlert[]> {
  const regioes = await api.regioes.listByCliente(clienteId) as Array<{ id: string; regiao: string; latitude?: number | null; longitude?: number | null }>;

  if (!regioes || regioes.length === 0) return [];

  const regIds = regioes.map((r) => r.id);
  const regMap = new Map(regioes.map((r) => [r.id, r]));

  const forecastData = await api.pluvioRisco.listByRegioes(regIds) as Array<{
    regiao_id: string; dt_ref: string; prev_d1_mm?: number | null; prev_d2_mm?: number | null;
    prev_d3_mm?: number | null; classificacao_final?: string | null; temp_c?: number | null; vento_kmh?: number | null;
  }>;

  const allAlerts: WeatherAlert[] = [];

  {
    const seen = new Set<string>();
    for (const row of forecastData) {
      if (seen.has(row.regiao_id)) continue;
      seen.add(row.regiao_id);
      const reg = regMap.get(row.regiao_id);
      if (!reg) continue;

      const forecasts = [
        { day: 'D+1 (amanhã)', mm: row.prev_d1_mm },
        { day: 'D+2', mm: row.prev_d2_mm },
        { day: 'D+3', mm: row.prev_d3_mm },
      ];

      for (const f of forecasts) {
        if (f.mm != null && f.mm >= 10) {
          allAlerts.push({
            regiao: reg.regiao,
            type: f.mm >= 50 ? 'Tempestade forte' : f.mm >= 20 ? 'Chuva intensa' : 'Chuva moderada',
            severity: classifySeverity(f.mm),
            message: `${f.mm.toFixed(1)}mm previstos para ${f.day}`,
            day: f.day,
          });
        }
      }

      if (row.vento_kmh != null && row.vento_kmh >= 60) {
        allAlerts.push({
          regiao: reg.regiao,
          type: 'Vendaval',
          severity: row.vento_kmh >= 90 ? 'critico' : 'alto',
          message: `Vento de ${row.vento_kmh.toFixed(0)} km/h registrado`,
          day: 'Hoje',
        });
      }
    }
  }

  const regioesWithCoords = regioes.filter((r) => r.latitude && r.longitude);
  await Promise.allSettled(
    regioesWithCoords.slice(0, 5).map(async (reg) => {
      try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${reg.latitude}&longitude=${reg.longitude}&daily=precipitation_sum,wind_speed_10m_max&forecast_days=3&timezone=America%2FCampo_Grande`;
        const res = await fetch(url);
        const data = await res.json();
        if (!data.daily) return;

        const precips: number[] = data.daily.precipitation_sum || [];
        const winds: number[] = data.daily.wind_speed_10m_max || [];
        const dates: string[] = data.daily.time || [];

        for (let i = 0; i < precips.length; i++) {
          if (precips[i] >= 10) {
            const dayLabel = i === 0 ? 'Hoje' : i === 1 ? 'Amanhã' : `D+${i}`;
            const exists = allAlerts.some((a) => a.regiao === reg.regiao && a.day.includes(dayLabel));
            if (!exists) {
              allAlerts.push({
                regiao: reg.regiao,
                type: precips[i] >= 50 ? 'Tempestade forte' : precips[i] >= 20 ? 'Chuva intensa' : 'Chuva moderada',
                severity: classifySeverity(precips[i]),
                message: `${precips[i].toFixed(1)}mm previstos — ${dates[i]}`,
                day: dayLabel,
              });
            }
          }
          if (winds[i] >= 60) {
            const exists = allAlerts.some((a) => a.regiao === reg.regiao && a.type === 'Vendaval');
            if (!exists) {
              allAlerts.push({
                regiao: reg.regiao,
                type: 'Vendaval',
                severity: winds[i] >= 90 ? 'critico' : 'alto',
                message: `Vento de ${winds[i].toFixed(0)} km/h previsto — ${dates[i]}`,
                day: i === 0 ? 'Hoje' : `D+${i}`,
              });
            }
          }
        }
      } catch {
        // skip on fetch error
      }
    })
  );

  const sevOrder: Record<string, number> = { critico: 0, alto: 1, moderado: 2 };
  allAlerts.sort((a, b) => sevOrder[a.severity] - sevOrder[b.severity]);
  return allAlerts;
}

export const useStormAlerts = (clienteId: string | null) => {
  return useQuery({
    queryKey: ['storm_alerts', clienteId],
    queryFn: () => fetchStormAlerts(clienteId!),
    enabled: !!clienteId,
    staleTime: STALE.LONG,
  });
};
