import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

/**
 * Guard para rotas da área do agente de campo (/agente/*).
 * Permite apenas usuários com papel agente; demais redireciona para /dashboard.
 */
const AgenteGuard = ({ children }: { children: React.ReactNode }) => {
  const { isAgente, loading: authLoading } = useAuth();

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!isAgente) return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
};

export default AgenteGuard;
