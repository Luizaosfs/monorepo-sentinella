import { createContext, useContext, useState, useEffect, forwardRef, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Cliente } from '@/types/database';

/** Estado do contrato SaaS do tenant. Exposto globalmente via useClienteAtivo(). */
export interface TenantStatus {
  /** Valor raw da coluna cliente_plano.status */
  status: 'ativo' | 'trial' | 'suspenso' | 'cancelado' | 'inadimplente';
  /** Nome do plano ativo (ex: 'profissional') ou null se sem plano */
  planoNome: string | null;
  /** true → tenant bloqueado: suspenso, cancelado ou trial expirado */
  isBlocked: boolean;
  /** true → status='inadimplente' (aviso, ainda não bloqueado) */
  isInadimplente: boolean;
  /** true → em trial ativo (não expirado) */
  isTrialing: boolean;
  /** Dias restantes do trial. null fora de trial. 0 = expirado hoje. */
  trialDaysLeft: number | null;
}

interface ClienteAtivoContextType {
  clienteId: string | null;
  setClienteId: (id: string) => void;
  clientes: Cliente[];
  clienteAtivo: Cliente | null;
  /** P1-2: contexto do contrato SaaS — null enquanto carrega */
  tenantStatus: TenantStatus | null;
  /** P5: preenchido apenas para analista_regional; null para todos os outros papéis */
  agrupamentoId: string | null;
  loading: boolean;
}

const ClienteAtivoContext = createContext<ClienteAtivoContextType>({} as ClienteAtivoContextType);

const STORAGE_KEY = 'sentinela_cliente_ativo';

export const ClienteAtivoProvider = forwardRef<HTMLDivElement, { children: ReactNode }>(({ children }, _ref) => {
  const { usuario, isAdmin, loading: authLoading } = useAuth();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);
  const [tenantStatus, setTenantStatus] = useState<TenantStatus | null>(null);

  // Carrega cliente(s) disponíveis conforme o papel:
  // - Admin: todos os clientes ativos, seleção persistida em localStorage
  // - Demais papéis (supervisor, operador, notificador): apenas o cliente vinculado ao usuário
  useEffect(() => {
    if (authLoading) return;

    const load = async () => {
      if (isAdmin) {
        const { data } = await supabase
          .from('clientes')
          .select('*')
          .eq('ativo', true)
          .order('nome');

        const list = data || [];
        setClientes(list);

        // Valida seleção persistida
        if (selectedId && !list.find((c) => c.id === selectedId)) {
          setSelectedId(list[0]?.id || null);
        } else if (!selectedId && list.length > 0) {
          setSelectedId(list[0].id);
        }
        setLoading(false);
        return;
      }

      // Não-admin: carrega apenas o cliente do usuário (para ter latitude/longitude, área, etc.)
      const userClienteId = usuario?.cliente_id || null;
      if (!userClienteId) {
        setClientes([]);
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from('clientes')
        .select('*')
        .eq('id', userClienteId)
        .maybeSingle();

      setClientes(data ? [data] : []);
      setLoading(false);
    };

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, authLoading, usuario?.cliente_id]);



  const clienteId = isAdmin ? selectedId : usuario?.cliente_id || null;

  // P1-2: busca contexto do contrato SaaS sempre que o clienteId ativo mudar.
  // Depende do clienteId computado acima (que por sua vez depende de isAdmin + selectedId).
  useEffect(() => {
    if (!clienteId) { setTenantStatus(null); return; }

    supabase.rpc('fn_get_tenant_context', { p_cliente_id: clienteId })
      .then(({ data, error }) => {
        if (error || !data) {
          // Fail-safe conservador: preserva o estado anterior se existir,
          // especialmente isBlocked=true — não reseta bloqueio em caso de erro de rede.
          // Se não há estado anterior (primeira carga), assume acesso liberado mas sem plano.
          console.warn('[TenantContext] fn_get_tenant_context falhou — preservando estado anterior:', error?.message);
          setTenantStatus(prev => prev ?? {
            status: 'ativo',
            planoNome: null,
            isBlocked: false,
            isInadimplente: false,
            isTrialing: false,
            trialDaysLeft: null,
          });
          return;
        }
        const d = data as {
          status: string;
          plano_nome: string | null;
          is_blocked: boolean;
          is_inadimplente: boolean;
          is_trialing: boolean;
          trial_days_left: number | null;
        };
        setTenantStatus({
          status: d.status as TenantStatus['status'],
          planoNome: d.plano_nome,
          isBlocked: d.is_blocked,
          isInadimplente: d.is_inadimplente,
          isTrialing: d.is_trialing,
          trialDaysLeft: d.trial_days_left,
        });
      })
      .catch((err) => {
        console.warn('[TenantContext] Erro inesperado ao buscar contexto de tenant:', err);
        setTenantStatus(prev => prev ?? {
          status: 'ativo',
          planoNome: null,
          isBlocked: false,
          isInadimplente: false,
          isTrialing: false,
          trialDaysLeft: null,
        });
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteId]);

  const handleSetClienteId = (id: string) => {
    setSelectedId(id);
    try { localStorage.setItem(STORAGE_KEY, id); } catch { /* ignore */ }
  };

  const clienteAtivo = clientes.find(c => c.id === clienteId) || null;
  const agrupamentoId = usuario?.agrupamento_id ?? null;

  return (
    <ClienteAtivoContext.Provider value={{
      clienteId,
      setClienteId: handleSetClienteId,
      clientes,
      clienteAtivo,
      tenantStatus,
      agrupamentoId,
      loading,
    }}>
      {children}
    </ClienteAtivoContext.Provider>
  );
});
ClienteAtivoProvider.displayName = 'ClienteAtivoProvider';

// eslint-disable-next-line react-refresh/only-export-components
export function useClienteAtivo() {
  return useContext(ClienteAtivoContext);
}
