/**
 * http-client — wrapper de fetch para o backend NestJS.
 *
 * - Injeta Authorization: Bearer <access_token> automaticamente
 * - Envia credentials: 'include' em todos os requests (cookie httpOnly do refresh_token)
 * - Faz refresh proativo (pré-request via isExpired) e reativo (retry em 401)
 * - Lança erros tipados (HttpClientError)
 */

import { tokenStore } from './token-store';

export class HttpClientError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = 'HttpClientError';
  }
}

let baseUrl = '';

export function configureHttpClient(url: string): void {
  baseUrl = url.replace(/\/$/, '');
}

// Deduplicação: enquanto um refresh estiver em voo, chamadas concorrentes
// aguardam a mesma Promise — evita rotacionar o refresh_token N vezes em
// paralelo (o backend marca used_at na 1ª e rejeita as demais como 401).
let inflightRefresh: Promise<boolean> | null = null;

async function refreshTokens(): Promise<boolean> {
  if (inflightRefresh) return inflightRefresh;

  inflightRefresh = (async () => {
    try {
      // Sem body — o refresh_token viaja no cookie httpOnly automaticamente.
      const res = await fetch(`${baseUrl}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) return false;
      const data = (await res.json()) as { accessToken: string };
      tokenStore.setTokens(data.accessToken);
      return true;
    } catch {
      return false;
    } finally {
      inflightRefresh = null;
    }
  })();

  return inflightRefresh;
}

function handleSessionExpired(): never {
  tokenStore.clear();
  window.dispatchEvent(new Event('sentinella:session-expired'));
  throw new HttpClientError(
    401,
    'Sua sessão foi encerrada. Isso pode acontecer se você ficou muito tempo sem usar o sistema, fez login em outro dispositivo, ou trocou sua senha. Faça login novamente.',
  );
}

export async function httpRequest<T>(
  path: string,
  options: RequestInit & { skipAuth?: boolean } = {},
  _alreadyRetried = false,
): Promise<T> {
  const { skipAuth, ...fetchOptions } = options;

  // Refresh proativo: antes de chamadas autenticadas quando token está próximo de expirar
  if (!skipAuth && tokenStore.isExpired()) {
    const ok = await refreshTokens();
    if (!ok) handleSessionExpired();
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(fetchOptions.headers as Record<string, string> | undefined),
  };

  if (!skipAuth) {
    const token = tokenStore.getAccessToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  // credentials: 'include' envia o cookie httpOnly do refresh_token em requests
  // para /auth/refresh e /auth/logout. Em outros endpoints é inofensivo.
  const res = await fetch(`${baseUrl}${path}`, {
    ...fetchOptions,
    headers,
    credentials: 'include',
  });

  if (!res.ok) {
    let body: unknown;
    try { body = await res.json(); } catch { /* ignorar */ }
    const message =
      typeof body === 'object' && body !== null && 'message' in body
        ? String((body as { message: string }).message)
        : `HTTP ${res.status}`;

    // Refresh reativo: retry único em 401 (defesa contra race condition token expirado).
    // Se o refresh falhar OU se o retry também retornar 401, encerra a sessão.
    if (res.status === 401 && !skipAuth && path !== '/auth/refresh') {
      if (!_alreadyRetried) {
        const ok = await refreshTokens();
        if (ok) return httpRequest<T>(path, options, true);
        // refresh falhou — cai em handleSessionExpired abaixo
      }
      // _alreadyRetried=true (token recém-emitido ainda rejeitado) ou refresh falhou
      handleSessionExpired();
    }

    throw new HttpClientError(res.status, message, body);
  }

  // 204 No Content
  if (res.status === 204) return undefined as unknown as T;

  return res.json() as Promise<T>;
}

/** Renova o access_token silenciosamente via cookie httpOnly.
 *  Usa a mesma deduplicação (inflightRefresh) do refresh reativo — chamadas
 *  concorrentes (ex.: StrictMode double-invoke) aguardam o mesmo Promise. */
export function silentRefresh(): Promise<boolean> {
  return refreshTokens();
}

type HttpOpts = RequestInit & { skipAuth?: boolean };

/** Atalhos HTTP */
export const http = {
  get: <T>(path: string, opts?: HttpOpts) =>
    httpRequest<T>(path, { ...opts, method: 'GET' }),

  post: <T>(path: string, body?: unknown, opts?: HttpOpts) =>
    httpRequest<T>(path, {
      ...opts,
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),

  patch: <T>(path: string, body?: unknown, opts?: HttpOpts) =>
    httpRequest<T>(path, {
      ...opts,
      method: 'PATCH',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),

  put: <T>(path: string, body?: unknown, opts?: HttpOpts) =>
    httpRequest<T>(path, {
      ...opts,
      method: 'PUT',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),

  delete: <T>(path: string, opts?: HttpOpts) =>
    httpRequest<T>(path, { ...opts, method: 'DELETE' }),
};
