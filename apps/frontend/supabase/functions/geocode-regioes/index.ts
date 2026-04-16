// Geocodifica um lote de nomes de regiões via open-meteo (server-side, paralelo).
// POST { nomes: string[], cidade?: string }
// → { results: { nome: string, latitude: number | null, longitude: number | null }[] }

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const APP_ORIGIN = Deno.env.get('APP_ORIGIN');
if (!APP_ORIGIN) {
  console.warn('[geocode-regioes] APP_ORIGIN não configurada — usando fallback restritivo');
}
const ALLOWED_ORIGIN = APP_ORIGIN ?? 'https://app.sentinella.com.br';

const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_NOMES = 100;

interface GeoResult {
  country_code?: string;
  latitude: number;
  longitude: number;
  name: string;
  admin1?: string;
}

async function geocodeOne(nome: string, cidade: string): Promise<{ latitude: number; longitude: number } | null> {
  const query = cidade ? `${nome}, ${cidade}` : nome;
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=pt&format=json`;

  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) return null;

  const data = await res.json() as { results?: GeoResult[] };
  const results = data.results;
  if (!results || results.length === 0) return null;

  const best = results.find((r) => r.country_code === 'BR') ?? results[0];
  return { latitude: best.latitude, longitude: best.longitude };
}

// Processa um array de Promises com no máximo `limit` concurrent
async function parallelLimit<T>(
  tasks: (() => Promise<T>)[],
  limit: number
): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = [];
  for (let i = 0; i < tasks.length; i += limit) {
    const batch = tasks.slice(i, i + limit).map((fn) => fn());
    const settled = await Promise.allSettled(batch);
    results.push(...settled);
  }
  return results;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Método não permitido' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Autenticação obrigatória — apenas usuários reais (não anon key).
  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Autenticação obrigatória' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  {
    const authClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error } = await authClient.auth.getUser();
    if (error || !user) {
      return new Response(JSON.stringify({ error: 'Sessão inválida ou expirada' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  let body: { nomes?: unknown; cidade?: unknown };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Body JSON inválido' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (!Array.isArray(body.nomes) || body.nomes.length === 0) {
    return new Response(JSON.stringify({ error: '"nomes" deve ser um array não vazio' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const nomes = (body.nomes as unknown[]).slice(0, MAX_NOMES).map(String);
  const cidade = typeof body.cidade === 'string' ? body.cidade.trim() : '';

  const tasks = nomes.map((nome) => () => geocodeOne(nome, cidade));
  const settled = await parallelLimit(tasks, 10);

  const results = nomes.map((nome, i) => {
    const outcome = settled[i];
    const coords = outcome.status === 'fulfilled' ? outcome.value : null;
    return {
      nome,
      latitude: coords?.latitude ?? null,
      longitude: coords?.longitude ?? null,
    };
  });

  const geocodedCount = results.filter((r) => r.latitude !== null).length;

  return new Response(
    JSON.stringify({ ok: true, total: nomes.length, geocoded: geocodedCount, results }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
});
