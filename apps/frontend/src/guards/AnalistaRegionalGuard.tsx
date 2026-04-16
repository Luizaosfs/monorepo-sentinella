import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';

/**
 * Protege rotas da área regional (/regional/*).
 * Permite: analista_regional, admin (para suporte/visualização).
 * Bloqueia: supervisor, agente, notificador → redireciona para /dashboard.
 */
export const AnalistaRegionalGuard = ({ children }: { children: React.ReactNode }) => {
  const { isAnalistaRegional, isAdmin, loading: authLoading } = useAuth();

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!isAnalistaRegional && !isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};
