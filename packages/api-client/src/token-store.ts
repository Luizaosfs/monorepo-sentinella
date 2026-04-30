/**
 * token-store — armazena access_token em memória (variável JS).
 *
 * SEGURANÇA:
 * - access_token vive apenas enquanto a aba está aberta.
 *   Não persiste em localStorage → não é acessível a scripts injetados (XSS).
 * - refresh_token é gerenciado exclusivamente pelo backend como cookie
 *   httpOnly, Secure, SameSite=Strict — JS nunca o lê ou escreve.
 *
 * CONSEQUÊNCIA (page refresh):
 * - Ao recarregar a página o access_token é perdido.
 *   useAuth.loadMe tenta silent refresh via cookie httpOnly antes de
 *   considerar o usuário deslogado.
 */

let _accessToken: string | null = null;

export const tokenStore = {
  getAccessToken(): string | null {
    return _accessToken;
  },

  /** Armazena o novo access_token em memória. Aceita apenas 1 argumento —
   *  o refresh_token trafega exclusivamente no cookie httpOnly do backend. */
  setTokens(access: string): void {
    _accessToken = access;
  },

  /** Limpa o access_token da memória (logout ou sessão expirada). */
  clear(): void {
    _accessToken = null;
  },

  /** Decodifica payload do JWT sem verificar assinatura (uso client-side apenas). */
  decodePayload<T = Record<string, unknown>>(): T | null {
    if (!_accessToken) return null;
    try {
      const [, payloadB64] = _accessToken.split('.');
      const json = atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/'));
      return JSON.parse(json) as T;
    } catch {
      return null;
    }
  },

  /** Retorna true se o access_token existe e está próximo de expirar (margem 30s). */
  isExpired(): boolean {
    if (!_accessToken) return false; // sem token — não expirado, apenas não autenticado
    const payload = this.decodePayload<{ exp?: number }>();
    if (!payload?.exp) return true; // token malformado — tratar como expirado
    return Date.now() / 1000 >= payload.exp - 30; // 30s de margem
  },
};
