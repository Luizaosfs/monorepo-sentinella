import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || '';
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || '';

// Durante a migração para NestJS: Supabase é opcional.
// Auth já usa NestJS. Queries de dados migram módulo a módulo (Fase 2+).
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[supabase] VITE_SUPABASE_URL/ANON_KEY não configurados — dados via NestJS apenas.');
}

export { supabaseUrl, supabaseAnonKey };
export const supabase = createClient(
  supabaseUrl || 'https://stub.supabase.co',
  supabaseAnonKey || 'stub',
);
