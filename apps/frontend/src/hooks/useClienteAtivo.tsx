import { createContext, useContext, useState, useEffect, forwardRef, type ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/services/api';
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
      try {
        const list = (await api.clientes.list()) as Cliente[];
        const sorted = [...list].sort((a, b) => a.nome.localeCompare(b.nome));

        if (isAdmin) {
          setClientes(sorted);
          if (selectedId && !sorted.find((c) => c.id === selectedId)) {
            setSelectedId(sorted[0]?.id || null);
          } else if (!selectedId && sorted.length > 0) {
            setSelectedId(sorted[0].id);
          }
        } else {
          const userClienteId = usuario?.cliente_id || null;
          const userCliente = sorted.find((c) => c.id === userClienteId);
          setClientes(userCliente ? [userCliente] : []);
        }
      } catch {
        setClientes([]);
      } finally {
        setLoading(false);
      }
    };

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, authLoading, usuario?.cliente_id]);



  const clienteId = isAdmin ? selectedId : usuario?.cliente_id || null;

  // P1-2: busca contexto do contrato SaaS sempre que o clienteId ativo mudar.
  // Depende do clienteId computado acima (que por sua vez depende de isAdmin + selectedId).
  useEffect(() => {
    if (!clienteId) { setTenantStatus(null); return; }

    // Tenant context via NestJS (billing endpoint pendente — usa safe default por enquanto)
    setTenantStatus({
      status: 'ativo',
      planoNome: null,
      isBlocked: false,
      isInadimplente: false,
      isTrialing: false,
      trialDaysLeft: null,
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
