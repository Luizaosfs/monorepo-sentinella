import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';

/**
 * Protege rotas da área notificador (/notificador, /notificador/registrar).
 * Permite: SOMENTE notificador.
 * Supervisor e admin têm telas de gestão de casos em /admin/casos — não acessam aqui.
 */
export const NotificadorGuard = ({ children }: { children: React.ReactNode }) => {
  const { isNotificador, loading: authLoading } = useAuth();

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!isNotificador) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};
