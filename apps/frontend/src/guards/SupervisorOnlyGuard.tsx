import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';

/** Protege rotas do fluxo operacional municipal (/gestor/*).
 *  Permite APENAS supervisor. Admin da plataforma NÃO acessa operação municipal. */
export const SupervisorOnlyGuard = ({ children }: { children: React.ReactNode }) => {
  const { isSupervisor, loading: authLoading } = useAuth();

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!isSupervisor) return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
};
