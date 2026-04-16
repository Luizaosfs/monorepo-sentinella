import { useState, useCallback } from 'react';

export type GeolocationState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; latitude: number; longitude: number; accuracy: number }
  | { status: 'denied' }
  | { status: 'error'; message: string };

/**
 * Hook para obter a geolocalização do dispositivo.
 * - `request()`: dispara a solicitação (permite chamar manualmente ou em useEffect)
 * - `state`: estado atual da requisição
 *
 * Uso automático (dispara na montagem):
 *   useEffect(() => { request(); }, []);
 */
export function useGeolocation(options?: PositionOptions) {
  const [state, setState] = useState<GeolocationState>({ status: 'idle' });

  const request = useCallback(() => {
    if (!navigator.geolocation) {
      setState({ status: 'error', message: 'Geolocalização não suportada neste dispositivo.' });
      return;
    }

    setState({ status: 'loading' });

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setState({
          status: 'success',
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setState({ status: 'denied' });
        } else {
          setState({ status: 'error', message: err.message || 'Erro ao obter localização.' });
        }
      },
      {
        timeout: 10000,
        maximumAge: 30000,
        enableHighAccuracy: false,
        ...options,
      }
    );
  }, [options]);

  const reset = useCallback(() => setState({ status: 'idle' }), []);

  return { state, request, reset };
}
