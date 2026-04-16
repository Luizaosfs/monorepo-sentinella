import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getCurrentPosition,
  reverseGeocode,
  forwardGeocode,
  reverseGeocodeDetailed,
  getCurrentLocationAndAddress,
} from './geo';

describe('geo', () => {
  const origFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = origFetch;
    vi.restoreAllMocks();
  });

  describe('getCurrentPosition', () => {
    const setGeo = (impl: typeof navigator.geolocation) => {
      Object.defineProperty(navigator, 'geolocation', {
        configurable: true,
        writable: true,
        value: impl,
      });
    };

    afterEach(() => {
      setGeo(undefined as unknown as Geolocation);
    });

    it('rejeita quando geolocation não existe', async () => {
      setGeo(undefined as unknown as Geolocation);
      await expect(getCurrentPosition()).rejects.toThrow('suportada');
    });

    it('resolve com lat/lng', async () => {
      setGeo({
        getCurrentPosition: (success) => {
          success({
            coords: { latitude: -23.5, longitude: -46.6 },
          } as GeolocationPosition);
        },
      } as Geolocation);
      await expect(getCurrentPosition()).resolves.toEqual({ lat: -23.5, lng: -46.6 });
    });

    it('rejeita permissão negada (code 1)', async () => {
      setGeo({
        getCurrentPosition: (_ok, err) => {
          err?.({ code: 1 } as GeolocationPositionError);
        },
      } as Geolocation);
      await expect(getCurrentPosition()).rejects.toThrow('negada');
    });

    it('rejeita posição indisponível (code 2)', async () => {
      setGeo({
        getCurrentPosition: (_ok, err) => {
          err?.({ code: 2 } as GeolocationPositionError);
        },
      } as Geolocation);
      await expect(getCurrentPosition()).rejects.toThrow('indisponível');
    });

    it('rejeita erro genérico (outro code)', async () => {
      setGeo({
        getCurrentPosition: (_ok, err) => {
          err?.({ code: 99 } as GeolocationPositionError);
        },
      } as Geolocation);
      await expect(getCurrentPosition()).rejects.toThrow('Não foi possível obter');
    });
  });

  describe('reverseGeocode', () => {
    it('lança se resposta não ok', async () => {
      vi.mocked(fetch).mockResolvedValue({ ok: false } as Response);
      await expect(reverseGeocode(0, 0)).rejects.toThrow('Falha ao buscar endereço');
    });

    it('monta endereço a partir do JSON Nominatim', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({
          address: {
            road: 'Rua A',
            house_number: '10',
            suburb: 'Centro',
            city: 'São Paulo',
            state: 'SP',
            postcode: '01000',
            country: 'Brasil',
          },
        }),
      } as Response);
      const r = await reverseGeocode(-23, -46);
      expect(r.endereco_curto).toContain('Rua A');
      expect(r.endereco_completo).toContain('São Paulo');
    });

    it('usa display_name quando não há partes', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ display_name: 'Somente display' }),
      } as Response);
      const r = await reverseGeocode(1, 2);
      expect(r.endereco_curto).toBe('Somente display');
    });
  });

  describe('forwardGeocode', () => {
    it('lança se não ok', async () => {
      vi.mocked(fetch).mockResolvedValue({ ok: false } as Response);
      await expect(forwardGeocode('x')).rejects.toThrow('Falha ao buscar coordenadas');
    });

    it('retorna null para array vazio', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => [],
      } as Response);
      await expect(forwardGeocode('nada')).resolves.toBeNull();
    });

    it('retorna lat/lng do primeiro resultado', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => [{ lat: '-10.5', lon: '-20.25' }],
      } as Response);
      await expect(forwardGeocode('rua')).resolves.toEqual({ lat: -10.5, lng: -20.25 });
    });
  });

  describe('reverseGeocodeDetailed', () => {
    it('inclui bairro, cidade, estado, cep', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({
          address: {
            road: 'Rua B',
            suburb: 'Jardim',
            city: 'Campinas',
            state: 'SP',
            postcode: '13000',
          },
        }),
      } as Response);
      const r = await reverseGeocodeDetailed(-22, -47);
      expect(r.bairro).toBe('Jardim');
      expect(r.cidade).toBe('Campinas');
      expect(r.estado).toBe('SP');
      expect(r.cep).toBe('13000');
    });
  });

  describe('getCurrentLocationAndAddress', () => {
    it('encadeia posição e reverse', async () => {
      Object.defineProperty(navigator, 'geolocation', {
        configurable: true,
        value: {
          getCurrentPosition: (success: PositionCallback) => {
            success({
              coords: { latitude: 1, longitude: 2 },
            } as GeolocationPosition);
          },
        },
      });
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({
          address: { road: 'X', city: 'Y' },
        }),
      } as Response);
      const r = await getCurrentLocationAndAddress();
      expect(r.lat).toBe(1);
      expect(r.lng).toBe(2);
      expect(r.endereco_curto).toContain('X');
    });
  });
});
