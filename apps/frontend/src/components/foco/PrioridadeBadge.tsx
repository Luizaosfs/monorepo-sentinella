import { Badge } from '@/components/ui/badge';
import type { FocoRiscoPrioridade } from '@/types/database';

const COR_PRIORIDADE: Record<string, string> = {
  P1: '#E24B4A',
  P2: '#D85A30',
  P3: '#BA7517',
  P4: '#378ADD',
  P5: '#888780',
};

interface Props {
  prioridade: FocoRiscoPrioridade | null | undefined;
  className?: string;
}

export function PrioridadeBadge({ prioridade, className }: Props) {
  if (!prioridade) return null;
  const cor = COR_PRIORIDADE[prioridade] ?? '#888780';
  return (
    <Badge
      className={className}
      style={{ backgroundColor: cor, color: '#fff', border: 'none' }}
    >
      {prioridade}
    </Badge>
  );
}
