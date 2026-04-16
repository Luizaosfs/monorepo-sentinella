import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Variáveis de ambiente VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY são obrigatórias. ' +
    'Crie o arquivo .env.local com essas variáveis antes de rodar a aplicação.',
  );
}

export { supabaseUrl, supabaseAnonKey };
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
