/**
 * @sentinella/api-client
 *
 * HTTP client JWT-based para o frontend Sentinella + backend NestJS.
 *
 * Uso:
 *   import { http, tokenStore, configureHttpClient } from '@sentinella/api-client'
 *
 * Inicialização (em main.tsx ou equivalente):
 *   configureHttpClient(import.meta.env.VITE_API_URL)
 */

export { http, httpRequest, configureHttpClient, HttpClientError, silentRefresh } from './http-client';
export { tokenStore } from './token-store';
