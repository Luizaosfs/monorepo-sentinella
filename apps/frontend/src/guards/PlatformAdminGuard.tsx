import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';

/**
 * Bloqueia acesso a rotas exclusivas do administrador da plataforma (cross-tenant).
 * Supervisor (gestor municipal) é redirecionado para a Central do Dia.
 *
 * Rotas protegidas: /admin/dashboard, /admin/clientes, /admin/saude-sistema,
 * /admin/job-queue, /admin/quotas, /admin/painel-municipios, …
 */
export const PlatformAdminGuard = ({ children }: { children: React.ReactNode }) => {
  const { isAdmin, loading: authLoading } = useAuth();

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!isAdmin) return <Navigate to="/gestor/central" replace />;

  return <>{children}</>;
};
