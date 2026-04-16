import { useAuth } from '@/hooks/useAuth';
import { useClienteAtivo } from '@/hooks/useClienteAtivo';
import { AlertTriangle, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Bloqueia o acesso ao app quando o tenant está suspenso, cancelado ou com trial expirado.
 *
 * - Admin da plataforma (isAdmin) sempre passa: precisa acessar /admin para resolver a situação.
 * - tenantStatus null (ainda carregando) passa: evita flash de tela de bloqueio durante boot.
 * - isBlocked === true para qualquer outro papel → mostra tela de conta bloqueada.
 */
export const TenantBlockedGuard = ({ children }: { children: React.ReactNode }) => {
  const { isAdmin, signOut } = useAuth();
  const { tenantStatus } = useClienteAtivo();

  // Admin da plataforma nunca é bloqueado (não tem tenant próprio)
  if (isAdmin) return <>{children}</>;

  // Ainda carregando o status — deixa passar para evitar flash
  if (tenantStatus === null) return <>{children}</>;

  if (tenantStatus.isBlocked) {
    const motivo =
      tenantStatus.status === 'suspenso'   ? 'Conta suspensa'
      : tenantStatus.status === 'cancelado' ? 'Conta cancelada'
      : 'Período de avaliação encerrado';

    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-8 bg-background">
        <AlertTriangle className="w-12 h-12 text-destructive" />
        <h1 className="text-2xl font-bold text-destructive">{motivo}</h1>
        <p className="text-muted-foreground text-center max-w-md">
          O acesso a esta conta foi bloqueado. Entre em contato com o administrador da plataforma
          para regularizar a situação.
        </p>
        {tenantStatus.planoNome && (
          <p className="text-sm text-muted-foreground">Plano: {tenantStatus.planoNome}</p>
        )}
        <Button variant="outline" onClick={signOut} className="mt-2 gap-2">
          <LogOut className="w-4 h-4" />
          Sair da conta
        </Button>
      </div>
    );
  }

  return <>{children}</>;
};
