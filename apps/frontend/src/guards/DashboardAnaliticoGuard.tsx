import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';

/**
 * Protege a rota /gestor/dashboard-analitico.
 * Permite: admin, supervisor e analista_regional.
 * Bloqueia: agente, notificador → redireciona para /dashboard.
 */
export const DashboardAnaliticoGuard = ({ children }: { children: React.ReactNode }) => {
  const { isAdminOrSupervisor, isAnalistaRegional, loading: authLoading } = useAuth();

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!isAdminOrSupervisor && !isAnalistaRegional) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};
