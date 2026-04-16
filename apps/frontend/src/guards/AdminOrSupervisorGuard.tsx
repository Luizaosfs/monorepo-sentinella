import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';

/** Protege uma rota para apenas admin ou supervisor (ex.: /operador/usuarios). */
export const AdminOrSupervisorGuard = ({ children }: { children: React.ReactNode }) => {
  const { isAdminOrSupervisor, loading: authLoading } = useAuth();

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!isAdminOrSupervisor) return <Navigate to="/" replace />;

  return <>{children}</>;
};
