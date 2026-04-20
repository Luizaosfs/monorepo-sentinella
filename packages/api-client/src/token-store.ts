const ACCESS_KEY = 'sentinella:access_token';
const REFRESH_KEY = 'sentinella:refresh_token';

export const tokenStore = {
  getAccessToken(): string | null {
    try {
      return localStorage.getItem(ACCESS_KEY);
    } catch {
      return null;
    }
  },

  getRefreshToken(): string | null {
    try {
      return localStorage.getItem(REFRESH_KEY);
    } catch {
      return null;
    }
  },

  setTokens(access: string, refresh: string): void {
    try {
      localStorage.setItem(ACCESS_KEY, access);
      localStorage.setItem(REFRESH_KEY, refresh);
    } catch {
      // ignorar (ex: modo privado Safari sem localStorage)
    }
  },

  clear(): void {
    try {
      localStorage.removeItem(ACCESS_KEY);
      localStorage.removeItem(REFRESH_KEY);
    } catch {
      // ignorar
    }
  },

  /** Decodifica payload do JWT sem verificar assinatura (uso client-side apenas). */
  decodePayload<T = Record<string, unknown>>(): T | null {
    const token = this.getAccessToken();
    if (!token) return null;
    try {
      const [, payloadB64] = token.split('.');
      const json = atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/'));
      return JSON.parse(json) as T;
    } catch {
      return null;
    }
  },

  isExpired(): boolean {
    if (!this.getAccessToken()) return false; // sem token — não expirado, apenas não autenticado
    const payload = this.decodePayload<{ exp?: number }>();
    if (!payload?.exp) return true; // token malformado — tratar como expirado
    return Date.now() / 1000 >= payload.exp - 30; // 30s de margem
  },
};
