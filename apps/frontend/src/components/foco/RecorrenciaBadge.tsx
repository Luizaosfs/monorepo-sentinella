import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { PADRAO_COR, PADRAO_LABEL } from '@/hooks/queries/useReincidenciaInteligente';

interface Props {
  focoAnteriorId?: string | null;
  padrao?: 'cronico' | 'recorrente' | 'pontual' | null;
  totalFocosImovel?: number | null;
  className?: string;
}

export function RecorrenciaBadge({ focoAnteriorId, padrao, totalFocosImovel, className }: Props) {
  if (!focoAnteriorId) return null;
  const label = padrao ? PADRAO_LABEL[padrao] : 'Reincidente';
  const count = totalFocosImovel && totalFocosImovel > 1 ? ` ×${totalFocosImovel}` : '';

  if (padrao) {
    return (
      <Badge className={cn('border text-[10px]', PADRAO_COR[padrao], className)}>
        {label}{count}
      </Badge>
    );
  }

  return (
    <Badge
      className={className}
      style={{ backgroundColor: '#BA7517', color: '#fff', border: 'none' }}
    >
      {label}{count}
    </Badge>
  );
}
