import { useClienteQuotasAll } from '@/hooks/queries/useClienteQuotas';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Gauge } from 'lucide-react';

/**
 * Badge numérico exibido ao lado do menu Quotas na sidebar.
 * Conta quantos clientes têm pelo menos uma métrica excedida.
 * Visível apenas para admins da plataforma.
 */
export function QuotaAlertBadge() {
  const { data: rawRows } = useClienteQuotasAll();
  const rows = rawRows ?? [];

  const excedidos = rows.filter(
    (r) => r.voos_excedido || r.levantamentos_excedido || r.itens_excedido || r.usuarios_excedido
  ).length;

  if (excedidos === 0) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="ml-auto inline-flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold h-4 min-w-4 px-1 leading-none">
            {excedidos}
          </span>
        </TooltipTrigger>
        <TooltipContent side="right">
          {excedidos} cliente{excedidos > 1 ? 's' : ''} com quota excedida
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
