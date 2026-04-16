/**
 * api-client-config — inicializa o HTTP client com a URL do backend NestJS.
 *
 * Importar este arquivo UMA VEZ no topo da árvore (main.tsx ou equivalente).
 * Usa VITE_API_URL do .env.local (ex: http://localhost:3333).
 */
import { configureHttpClient } from '@sentinella/api-client';

const apiUrl = import.meta.env.VITE_API_URL as string | undefined;

if (!apiUrl) {
  console.warn(
    '[api-client] VITE_API_URL não definida. ' +
    'Crie .env.local com VITE_API_URL=http://localhost:3333. ' +
    'Usando fallback para http://localhost:3333.',
  );
}

configureHttpClient(apiUrl ?? 'http://localhost:3333');
