/**
 * token-store — persiste access_token e refresh_token no localStorage.
 *
 * BRIDGE DE MIGRAÇÃO:
 * Durante a transição Supabase → NestJS, se não houver token NestJS,
 * lê automaticamente o token da sessão Supabase (sem importar @supabase/supabase-js).
 * Isso permite que o HTTP client funcione mesmo antes de migrar o useAuth.tsx.
 */

const ACCESS_KEY = 'sentinella:access_token';
const REFRESH_KEY = 'sentinella:refresh_token';

export const tokenStore = {
  getAccessToken(): string | null {
    try {
      // 1. Token NestJS JWT (após migração de auth)
      const nestToken = localStorage.getItem(ACCESS_KEY);
      if (nestToken) return nestToken;

      // 2. Bridge: lê token Supabase diretamente do localStorage (sem importar supabase-js)
      //    Supabase v2 armazena sob: sb-{project-ref}-auth-token
      return this._readSupabaseToken();
    } catch {
      return null;
    }
  },

  getRefreshToken(): string | null {
    try {
      const nestRefresh = localStorage.getItem(REFRESH_KEY);
      if (nestRefresh) return nestRefresh;
      return null; // refresh de Supabase é gerenciado pelo supabase-js
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
    // Se estamos usando token Supabase (bridge), não tentamos refresh via NestJS
    const nestToken = (() => { try { return localStorage.getItem(ACCESS_KEY); } catch { return null; } })();
    if (!nestToken) return false; // deixa o supabase-js gerenciar o refresh

    const payload = this.decodePayload<{ exp?: number }>();
    if (!payload?.exp) return true;
    return Date.now() / 1000 >= payload.exp - 30; // 30s de margem
  },

  /**
   * Lê o access_token da sessão Supabase diretamente do localStorage,
   * sem depender do @supabase/supabase-js SDK.
   * Supabase v2 salva a sessão sob a chave: sb-{projectRef}-auth-token
   */
  _readSupabaseToken(): string | null {
    try {
      const supabaseKey = Object.keys(localStorage).find(
        (k) => k.startsWith('sb-') && k.endsWith('-auth-token'),
      );
      if (!supabaseKey) return null;
      const raw = localStorage.getItem(supabaseKey);
      if (!raw) return null;
      const session = JSON.parse(raw) as { access_token?: string };
      return session?.access_token ?? null;
    } catch {
      return null;
    }
  },

  /** true se há sessão Supabase ativa (bridge mode). */
  isUsingSupabaseBridge(): boolean {
    try {
      const nestToken = localStorage.getItem(ACCESS_KEY);
      if (nestToken) return false;
      return this._readSupabaseToken() !== null;
    } catch {
      return false;
    }
  },
};
