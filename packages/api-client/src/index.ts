/**
 * @sentinella/api-client
 *
 * HTTP client para o frontend Sentinella.
 * Substitui progressivamente as chamadas supabase.from() e supabase.auth.*
 *
 * Uso:
 *   import { http, tokenStore, configureHttpClient } from '@sentinella/api-client'
 *
 * Inicialização (em main.tsx ou equivalente):
 *   configureHttpClient(import.meta.env.VITE_API_URL)
 *
 * NOTA: os módulos de domínio (auth, focos-risco, etc.) serão adicionados
 * durante a Fase 2 da migração, módulo a módulo.
 */

export { http, httpRequest, configureHttpClient, HttpClientError } from './http-client';
export { tokenStore } from './token-store';
