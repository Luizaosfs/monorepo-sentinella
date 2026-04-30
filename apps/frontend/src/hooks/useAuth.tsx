import { useState, useEffect, useRef, createContext, useContext, forwardRef, type ReactNode } from 'react';
import { http, tokenStore } from '@sentinella/api-client';
import '@/lib/api-client-config';
import { PapelApp } from '@/types/database';

type Papel = PapelApp | null;

type AuthMeResult = {
  id: string;
  authId: string;
  email: string;
  nome: string;
  clienteId: string | null;
  agrupamentoId: string | null;
  papeis: string[];
};

interface AuthContextType {
  /** @deprecated sempre null após migração para NestJS auth — use usuario */
  session: null;
  /** @deprecated sempre null após migração para NestJS auth — use usuario */
  user: null;
  usuario: AuthMeResult | null;
  papel: Papel;
  isAdmin: boolean;
  isSupervisor: boolean;
  isAgente: boolean;
  isNotificador: boolean;
  isAnalistaRegional: boolean;
  isAdminOrSupervisor: boolean;
  mustChangePassword: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: unknown }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

const ROLE_PRIORITY: Record<string, number> = {
  admin: 5,
  supervisor: 4,
  agente: 3,
  notificador: 2,
  analista_regional: 1,
};

export function normalizePapel(p: string): Papel {
  const lower = (p || '').toLowerCase().trim();
  if (lower === 'admin') return 'admin';
  if (lower === 'supervisor') return 'supervisor';
  if (lower === 'agente') return 'agente';
  if (lower === 'notificador') return 'notificador';
  if (lower === 'analista_regional') return 'analista_regional';
  return null;
}

function resolvePapel(papeis: string[]): Papel {
  if (!papeis?.length) return null;
  const highest = papeis.reduce((best, cur) => {
    const curPriority = ROLE_PRIORITY[cur.toLowerCase()] ?? 0;
    const bestPriority = ROLE_PRIORITY[best.toLowerCase()] ?? 0;
    return curPriority > bestPriority ? cur : best;
  });
  return normalizePapel(highest);
}

export const AuthProvider = forwardRef<HTMLDivElement, { children: ReactNode }>(({ children }, _ref) => {
  const [usuario, setUsuario] = useState<AuthMeResult | null>(null);
  const [papel, setPapel] = useState<Papel>(null);
  const [loading, setLoading] = useState(true);
  const usuarioRef = useRef<AuthMeResult | null>(null);
  useEffect(() => { usuarioRef.current = usuario; }, [usuario]);

  const loadMe = async () => {
    if (!tokenStore.getAccessToken()) {
      // Sem access_token em memória (page refresh normal) — tenta renovar
      // silenciosamente via cookie httpOnly antes de considerar deslogado.
      try {
        const refreshed = await http.post<{ accessToken: string; user: AuthMeResult }>(
          '/auth/refresh',
          undefined,
          { skipAuth: true },
        );
        tokenStore.setTokens(refreshed.accessToken);
        setUsuario(refreshed.user);
        setPapel(resolvePapel(refreshed.user.papeis));
      } catch {
        // Cookie ausente, inválido ou revogado — usuário não autenticado.
        setUsuario(null);
        setPapel(null);
      }
      return;
    }
    try {
      const me = await http.get<AuthMeResult>('/auth/me');
      setUsuario(me);
      setPapel(resolvePapel(me.papeis));
    } catch {
      tokenStore.clear();
      setUsuario(null);
      setPapel(null);
    }
  };

  useEffect(() => {
    let mounted = true;

    const boot = async () => {
      try {
        await loadMe();
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void boot();

    const onExpired = () => {
      import('sonner').then(({ toast }) =>
        toast.error('Sua sessão expirou. Faça login novamente.')
      );
      tokenStore.clear();
      setUsuario(null);
      setPapel(null);
    };

    window.addEventListener('sentinella:session-expired', onExpired);
    return () => {
      mounted = false;
      window.removeEventListener('sentinella:session-expired', onExpired);
    };
  }, []);

  const signIn = async (email: string, password: string): Promise<{ error: unknown }> => {
    try {
      const data = await http.post<{ accessToken: string; user: AuthMeResult }>(
        '/auth/login',
        { email: email.trim().toLowerCase(), password },
        { skipAuth: true },
      );
      tokenStore.setTokens(data.accessToken);
      setUsuario(data.user);
      setPapel(resolvePapel(data.user.papeis));
      return { error: null };
    } catch (err) {
      return { error: err };
    }
  };

  const signOut = async () => {
    try {
      await http.post('/auth/logout');
    } catch {
      // best-effort: se falhar (rede), limpa memória de qualquer forma
    }
    tokenStore.clear();
    setUsuario(null);
    setPapel(null);
  };

  const isAdmin = papel === 'admin';
  const isSupervisor = papel === 'supervisor';
  const isAgente = papel === 'agente';
  const isNotificador = papel === 'notificador';
  const isAnalistaRegional = papel === 'analista_regional';
  const isAdminOrSupervisor = isAdmin || isSupervisor;

  return (
    <AuthContext.Provider value={{
      session: null,
      user: null,
      usuario,
      papel,
      isAdmin,
      isSupervisor,
      isAgente,
      isNotificador,
      isAnalistaRegional,
      isAdminOrSupervisor,
      mustChangePassword: false,
      loading,
      signIn,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
});
AuthProvider.displayName = 'AuthProvider';

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
