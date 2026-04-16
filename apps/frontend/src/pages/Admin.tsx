import { useAuth } from '@/hooks/useAuth';
import { Navigate, Outlet } from 'react-router-dom';

const AdminGuard = () => {
  const { isAdmin, loading: authLoading } = useAuth();

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  // /admin/* é exclusivo do admin da plataforma. Supervisor → /gestor/central.
  if (!isAdmin) return <Navigate to="/gestor/central" replace />;

  return <Outlet />;
};

export { AdminOrSupervisorGuard } from '@/guards/AdminOrSupervisorGuard';
export default AdminGuard;
