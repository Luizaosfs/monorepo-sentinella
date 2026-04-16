/**
 * http-client — wrapper de fetch para o backend NestJS.
 *
 * - Injeta Authorization: Bearer <access_token> automaticamente
 * - Faz refresh automático do token quando expirado
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

async function refreshTokens(): Promise<boolean> {
  const refresh = tokenStore.getRefreshToken();
  if (!refresh) return false;

  try {
    const res = await fetch(`${baseUrl}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refresh }),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { access_token: string; refresh_token: string };
    tokenStore.setTokens(data.access_token, data.refresh_token);
    return true;
  } catch {
    return false;
  }
}

export async function httpRequest<T>(
  path: string,
  options: RequestInit & { skipAuth?: boolean } = {},
): Promise<T> {
  const { skipAuth, ...fetchOptions } = options;

  // Refresh automático antes de chamadas autenticadas
  if (!skipAuth && tokenStore.isExpired()) {
    const ok = await refreshTokens();
    if (!ok) {
      tokenStore.clear();
      // Disparar evento para useAuth redirecionar para login
      window.dispatchEvent(new Event('sentinella:session-expired'));
      throw new HttpClientError(401, 'Sessão expirada. Faça login novamente.');
    }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(fetchOptions.headers as Record<string, string> | undefined),
  };

  if (!skipAuth) {
    const token = tokenStore.getAccessToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${baseUrl}${path}`, { ...fetchOptions, headers });

  if (!res.ok) {
    let body: unknown;
    try { body = await res.json(); } catch { /* ignorar */ }
    const message =
      typeof body === 'object' && body !== null && 'message' in body
        ? String((body as { message: string }).message)
        : `HTTP ${res.status}`;
    throw new HttpClientError(res.status, message, body);
  }

  // 204 No Content
  if (res.status === 204) return undefined as unknown as T;

  return res.json() as Promise<T>;
}

/** Atalhos HTTP */
export const http = {
  get: <T>(path: string, opts?: RequestInit) =>
    httpRequest<T>(path, { ...opts, method: 'GET' }),

  post: <T>(path: string, body?: unknown, opts?: RequestInit) =>
    httpRequest<T>(path, {
      ...opts,
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),

  patch: <T>(path: string, body?: unknown, opts?: RequestInit) =>
    httpRequest<T>(path, {
      ...opts,
      method: 'PATCH',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),

  put: <T>(path: string, body?: unknown, opts?: RequestInit) =>
    httpRequest<T>(path, {
      ...opts,
      method: 'PUT',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),

  delete: <T>(path: string, opts?: RequestInit) =>
    httpRequest<T>(path, { ...opts, method: 'DELETE' }),
};
