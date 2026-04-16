import { useState, useEffect, createContext, useContext, forwardRef, type ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { Usuario, PapelApp } from '@/types/database';

/** Papel resolvido pelo frontend: PapelApp canônico ou null (sem acesso). */
type Papel = PapelApp | null;

/**
 * Hierarquia de papéis (ver PapelApp em src/types/database.ts):
 * 1. admin       — plataforma SaaS; acesso total (/admin/*)
 * 2. supervisor  — gestor municipal; portal /gestor/*
 * 3. agente      — operador de campo; portal /agente/*
 * 4. notificador — funcionário UBS; portal /notificador/*
 * null           — papel desconhecido / sem papel → redirecionar para login
 */
interface AuthContextType {
  session: Session | null;
  user: User | null;
  usuario: Usuario | null;
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

const ROLE_PRIORITY: Record<string, number> = { admin: 5, supervisor: 4, agente: 3, notificador: 2, analista_regional: 1 };

/** Refresh token inválido/ausente no servidor — limpar só o storage local evita loop de 400 no /token. */
function shouldClearLocalAuth(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const msg = ('message' in error && typeof (error as { message?: string }).message === 'string'
    ? (error as { message: string }).message
    : ''
  ).toLowerCase();
  const code = 'code' in error && typeof (error as { code?: string }).code === 'string'
    ? (error as { code: string }).code
    : '';
  return (
    msg.includes('refresh token') ||
    msg.includes('invalid refresh') ||
    msg.includes('invalid jwt') ||
    msg.includes('jwt expired') ||
    code === 'refresh_token_not_found'
  );
}

export function normalizePapel(p: string): Papel {
  const lower = (p || '').toLowerCase().trim();
  if (lower === 'admin') return 'admin';
  if (lower === 'supervisor') return 'supervisor';
  if (lower === 'agente') return 'agente';
  if (lower === 'notificador') return 'notificador';
  if (lower === 'analista_regional') return 'analista_regional';
  return null; // papel desconhecido/morto → sem acesso
}

export const AuthProvider = forwardRef<HTMLDivElement, { children: ReactNode }>(({ children }, _ref) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [papel, setPapel] = useState<Papel>(null);
  const [loading, setLoading] = useState(true);

  const loadUsuario = async (sessionUser: User | null) => {
    if (!sessionUser) {
      setUsuario(null);
      setPapel(null);
      return;
    }

    const byAuthId = await supabase
      .from('usuarios')
      .select('*')
      .eq('auth_id', sessionUser.id)
      .maybeSingle();

    const usuarioData = byAuthId.data ?? (await supabase
      .from('usuarios')
      .select('*')
      .eq('email', sessionUser.email)
      .maybeSingle()).data ?? null;

    // Bloquear usuário inativo ANTES de setar qualquer estado.
    // Cobre desativação pelo admin no backoffice — o próximo loadUsuario bloqueia acesso.
    if (usuarioData?.ativo === false) {
      await supabase.auth.signOut({ scope: 'local' });
      setUsuario(null);
      setPapel(null);
      return;
    }

    if (usuarioData) setUsuario(usuarioData);

    // 1) Fast-path: ler papel de app_metadata (P1-1 — JWT enrichment hook).
    //    Presente em tokens emitidos após ativação do custom_access_token_hook.
    //    Staleness máxima = duração do token (≤ 1h). Para revogação imediata,
    //    invalidar a sessão via Supabase Admin API.
    //    Hook também injeta usuario_ativo — bloquear antes de ler papel.
    if (sessionUser.app_metadata?.usuario_ativo === false) {
      await supabase.auth.signOut({ scope: 'local' });
      setUsuario(null);
      setPapel(null);
      return;
    }

    const metaPapel = sessionUser.app_metadata?.papel;
    if (metaPapel && typeof metaPapel === 'string') {
      setPapel(normalizePapel(metaPapel));
      return;
    }

    // 2) Fallback A: RPC — usa a mesma lógica do RLS (usuario_id = auth.uid()).
    //    Ativo para tokens pré-hook ou quando app_metadata.papel está ausente.
    const { data: rpcPapel } = await supabase.rpc('get_meu_papel');
    if (rpcPapel && typeof rpcPapel === 'string') {
      setPapel(normalizePapel(rpcPapel));
      return;
    }

    // 3) Fallback B: ler papeis_usuarios diretamente por auth.uid()
    // ATENÇÃO: papeis_usuarios.usuario_id = auth.uid() (NÃO usuarios.id que é UUID interno)
    const { data: papeisByAuth } = await supabase
      .from('papeis_usuarios')
      .select('papel')
      .eq('usuario_id', sessionUser.id); // sessionUser.id === auth.uid()
    const papeis = papeisByAuth ?? null;

    if (papeis && papeis.length > 0) {
      const highest = papeis.reduce((best, cur) => {
        const curKey = (cur.papel ?? '').toString().toLowerCase();
        const bestKey = (best.papel ?? '').toString().toLowerCase();
        const curPriority = ROLE_PRIORITY[curKey] ?? 0;
        const bestPriority = ROLE_PRIORITY[bestKey] ?? 0;
        return curPriority > bestPriority ? cur : best;
      });
      setPapel(normalizePapel((highest.papel ?? '').toString()));
      return;
    }

    setPapel(null); // sem papel em nenhuma fonte → sem acesso
  };

  useEffect(() => {
    let mounted = true;
    let subscription: { unsubscribe: () => void } | undefined;

    const boot = async () => {
      const { error: sessionError } = await supabase.auth.getSession();
      if (!mounted) return;
      if (sessionError && shouldClearLocalAuth(sessionError)) {
        await supabase.auth.signOut({ scope: 'local' });
      }
      if (!mounted) return;

      const { data } = supabase.auth.onAuthStateChange((event, session) => {
        if (!mounted) return;
        if (event === 'SIGNED_OUT' && !session) {
          import('sonner').then(({ toast }) =>
            toast.error('Sua sessão expirou. Faça login novamente.')
          );
        }
        setSession(session);
        setUser(session?.user ?? null);
        // setTimeout(0) libera o event loop antes de iniciar queries ao banco,
        // evitando deadlock com o cliente Supabase durante o boot.
        setTimeout(async () => {
          if (!mounted) return;
          try {
            await loadUsuario(session?.user ?? null);
          } catch (err) {
            console.error('[auth] erro ao carregar usuário', err);
          } finally {
            if (mounted) setLoading(false);
          }
        }, 0);
      });
      subscription = data.subscription;
    };

    void boot();

    const timeout = setTimeout(() => {
      if (mounted) setLoading(false);
    }, 3000);

    return () => {
      mounted = false;
      clearTimeout(timeout);
      subscription?.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const emailNorm = email.trim().toLowerCase();
    const { error } = await supabase.auth.signInWithPassword({
      email: emailNorm,
      password,
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUsuario(null);
    setPapel(null);
  };

  const isAdmin = papel === 'admin';
  const isSupervisor = papel === 'supervisor';
  const isAgente = papel === 'agente';
  const isNotificador = papel === 'notificador';
  const isAnalistaRegional = papel === 'analista_regional';
  const isAdminOrSupervisor = isAdmin || isSupervisor;
  const mustChangePassword = user?.user_metadata?.must_change_password === true;

  return (
    <AuthContext.Provider value={{ session, user, usuario, papel, isAdmin, isSupervisor, isAgente, isNotificador, isAnalistaRegional, isAdminOrSupervisor, mustChangePassword, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
});
AuthProvider.displayName = 'AuthProvider';

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
