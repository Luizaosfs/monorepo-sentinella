import { Injectable, Logger } from '@nestjs/common';

import { env } from '@/lib/env/server';

export interface GeocodeResult {
  lat: number;
  lng: number;
}

interface NominatimRow {
  lat: string;
  lon: string;
}

interface GoogleGeocodeResponse {
  status: string;
  error_message?: string;
  results?: Array<{ geometry: { location: { lat: number; lng: number } } }>;
}

const TIMEOUT_MS = 5000;

/**
 * Geocodifica um endereço textual → coordenadas.
 *
 * Usado quando uma denúncia do canal cidadão chega sem GPS, apenas com endereço.
 * Google Maps primeiro (precisão ROOFTOP para endereços BR — mesmo proxy de
 * `notificacao.controller.ts`); só usado se `GOOGLE_MAPS_KEY` estiver configurada.
 * Fallback Nominatim (OpenStreetMap, mesmo padrão/User-Agent de
 * `RegiaoGeocodeService`) quando não há chave ou o Google não resolve.
 *
 * Ordem importa: Nominatim erra o segmento de avenidas longas por vários km;
 * o Google retorna o número exato. Por isso o Google vem primeiro.
 *
 * Best-effort: erro, timeout ou sem resultado → `null`. Nunca lança.
 */
@Injectable()
export class GeocodificarEndereco {
  private readonly logger = new Logger(GeocodificarEndereco.name);

  async execute(
    endereco: string | null | undefined,
    cidade?: string | null,
    uf?: string | null,
  ): Promise<GeocodeResult | null> {
    const base = endereco?.trim();
    if (!base) return null;

    const viaGoogle = await this.geocodeGoogle(base, cidade, uf);
    if (viaGoogle) return viaGoogle;

    const query = [base, cidade, uf, 'Brasil'].filter(Boolean).join(', ');
    return this.geocodeNominatim(query);
  }

  private async geocodeNominatim(query: string): Promise<GeocodeResult | null> {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Sentinella/1.0 (suporte@sentinella.com.br)' },
        signal: ctrl.signal,
      });
      if (!res.ok) return null;
      const rows = (await res.json()) as NominatimRow[];
      if (!rows.length) return null;
      const lat = parseFloat(rows[0].lat);
      const lng = parseFloat(rows[0].lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      return { lat, lng };
    } catch (err) {
      this.logger.warn(
        `[geocodeNominatim] falha "${query}": ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    } finally {
      clearTimeout(t);
    }
  }

  private async geocodeGoogle(
    logradouro: string,
    cidade?: string | null,
    uf?: string | null,
  ): Promise<GeocodeResult | null> {
    if (!env.GOOGLE_MAPS_KEY) return null;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const address = encodeURIComponent(
        [logradouro, cidade, uf].filter(Boolean).join(', '),
      );
      const components = encodeURIComponent('country:BR');
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${address}&components=${components}&key=${env.GOOGLE_MAPS_KEY}&region=BR&language=pt-BR`;
      const res = await fetch(url, { signal: ctrl.signal });
      const json = (await res.json()) as GoogleGeocodeResponse;
      if (json.status === 'OK' && json.results?.length) {
        const { lat, lng } = json.results[0].geometry.location;
        return { lat, lng };
      }
      return null;
    } catch (err) {
      this.logger.warn(
        `[geocodeGoogle] falha "${logradouro}": ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    } finally {
      clearTimeout(t);
    }
  }
}
