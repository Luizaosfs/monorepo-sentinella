/**
 * Geolocalização e reverse geocoding (Nominatim / OSM).
 * Uso: obter coordenadas atuais e endereço do local do levantamento.
 */

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org';
const USER_AGENT = 'SentinelaWeb/1.0 (levantamento manual)';

export interface ReverseGeocodeResult {
  endereco_curto: string;
  endereco_completo: string;
}

/** Obtém a posição atual do dispositivo (pede permissão ao usuário). */
export function getCurrentPosition(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocalização não é suportada neste navegador.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => {
        if (err.code === 1) reject(new Error('Permissão de localização negada.'));
        else if (err.code === 2) reject(new Error('Posição indisponível.'));
        else reject(new Error('Não foi possível obter a localização.'));
      },
      // false: evita o fallback do Chrome que consulta Google (console 403 em algumas redes/VPNs).
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 }
    );
  });
}

/** Reverse geocoding: coordenadas → endereço (Nominatim). Respeita 1 req/s e User-Agent. */
export async function reverseGeocode(
  lat: number,
  lng: number
): Promise<ReverseGeocodeResult> {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lng),
    format: 'json',
    addressdetails: '1',
    'accept-language': 'pt-BR',
  });
  const res = await fetch(`${NOMINATIM_URL}/reverse?${params}`, {
    headers: { 'User-Agent': USER_AGENT },
  });
  if (!res.ok) throw new Error('Falha ao buscar endereço.');
  const data = (await res.json()) as {
    address?: {
      road?: string;
      house_number?: string;
      suburb?: string;
      neighbourhood?: string;
      city?: string;
      town?: string;
      village?: string;
      state?: string;
      postcode?: string;
      country?: string;
    };
    display_name?: string;
  };
  const addr = data.address || {};
  const municipio = addr.city || addr.town || addr.village || '';
  const bairro = addr.suburb || addr.neighbourhood || '';
  const rua = addr.road || '';
  const numero = addr.house_number || '';
  const estado = addr.state || '';
  const cep = addr.postcode || '';
  const pais = addr.country || '';

  const endereco_curto = [rua, numero].filter(Boolean).join(', ') || bairro || municipio || data.display_name || '';
  const partes = [rua, numero, bairro, municipio, estado, cep, pais].filter(Boolean);
  const endereco_completo = partes.length > 0 ? partes.join(', ') : (data.display_name as string) || '';

  return {
    endereco_curto: endereco_curto.trim() || 'Endereço não identificado',
    endereco_completo: endereco_completo.trim() || endereco_curto,
  };
}

/** Obtém posição atual e endereço (geolocalização + reverse geocoding). */
export async function getCurrentLocationAndAddress(): Promise<{
  lat: number;
  lng: number;
  endereco_curto: string;
  endereco_completo: string;
}> {
  const { lat, lng } = await getCurrentPosition();
  const { endereco_curto, endereco_completo } = await reverseGeocode(lat, lng);
  return { lat, lng, endereco_curto, endereco_completo };
}

/** Forward geocoding: endereço → coordenadas (Nominatim). */
export async function forwardGeocode(
  query: string
): Promise<{ lat: number; lng: number } | null> {
  const params = new URLSearchParams({
    q: query,
    format: 'json',
    limit: '1',
    countrycodes: 'br',
    'accept-language': 'pt-BR',
  });
  const res = await fetch(`${NOMINATIM_URL}/search?${params}`, {
    headers: { 'User-Agent': USER_AGENT },
  });
  if (!res.ok) throw new Error('Falha ao buscar coordenadas.');
  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) return null;
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
}

export interface ReverseGeocodeDetailResult extends ReverseGeocodeResult {
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
}

/** Reverse geocoding detalhado: coordenadas → endereço com campos separados. */
export async function reverseGeocodeDetailed(
  lat: number,
  lng: number
): Promise<ReverseGeocodeDetailResult> {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lng),
    format: 'json',
    addressdetails: '1',
    'accept-language': 'pt-BR',
  });
  const res = await fetch(`${NOMINATIM_URL}/reverse?${params}`, {
    headers: { 'User-Agent': USER_AGENT },
  });
  if (!res.ok) throw new Error('Falha ao buscar endereço.');
  const data = (await res.json()) as {
    address?: {
      road?: string;
      house_number?: string;
      suburb?: string;
      neighbourhood?: string;
      city?: string;
      town?: string;
      village?: string;
      state?: string;
      postcode?: string;
      country?: string;
    };
    display_name?: string;
  };
  const addr = data.address || {};
  const municipio = addr.city || addr.town || addr.village || '';
  const bairro = addr.suburb || addr.neighbourhood || '';
  const rua = addr.road || '';
  const numero = addr.house_number || '';
  const estado = addr.state || '';
  const cep = addr.postcode || '';
  const pais = addr.country || '';

  const endereco_curto = [rua, numero].filter(Boolean).join(', ') || bairro || municipio || data.display_name || '';
  const partes = [rua, numero, bairro, municipio, estado, cep, pais].filter(Boolean);
  const endereco_completo = partes.length > 0 ? partes.join(', ') : (data.display_name as string) || '';

  return {
    endereco_curto: endereco_curto.trim() || 'Endereço não identificado',
    endereco_completo: endereco_completo.trim() || endereco_curto,
    bairro,
    cidade: municipio,
    estado,
    cep,
  };
}
