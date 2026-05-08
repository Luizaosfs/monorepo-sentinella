import { Injectable, Logger } from '@nestjs/common';

export interface OpenMeteoStormData {
  precipitacaoDias: number[];
  ventoDias: number[];
}

@Injectable()
export class OpenMeteoService {
  private readonly logger = new Logger(OpenMeteoService.name);
  private readonly TIMEOUT_MS = 8_000;

  async fetchStormForecast(lat: number, lng: number): Promise<OpenMeteoStormData | null> {
    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${lat}&longitude=${lng}` +
      `&daily=precipitation_sum,wind_speed_10m_max` +
      `&forecast_days=4&timezone=America%2FSao_Paulo`;

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.TIMEOUT_MS);

    try {
      const res = await fetch(url, { signal: ctrl.signal });
      if (!res.ok) return null;
      const data = await res.json() as {
        daily?: { precipitation_sum?: number[]; wind_speed_10m_max?: number[] };
      };
      return {
        precipitacaoDias: data.daily?.precipitation_sum ?? [],
        ventoDias: data.daily?.wind_speed_10m_max ?? [],
      };
    } catch (err: any) {
      this.logger.warn(`[fetchStormForecast] lat=${lat} lng=${lng} erro="${err?.message}"`);
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
}
