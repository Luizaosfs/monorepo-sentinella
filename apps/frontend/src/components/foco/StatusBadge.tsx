import { Badge } from '@/components/ui/badge';
import { COR_STATUS, LABEL_STATUS } from '@/types/focoRisco';
import type { FocoRiscoStatus } from '@/types/database';

interface Props {
  status: FocoRiscoStatus;
  className?: string;
}

export function StatusBadge({ status, className }: Props) {
  const cor = COR_STATUS[status] ?? '#888780';
  const label = LABEL_STATUS[status] ?? status;
  return (
    <Badge
      className={className}
      style={{ backgroundColor: cor, color: '#fff', border: 'none' }}
    >
      {label}
    </Badge>
  );
}
