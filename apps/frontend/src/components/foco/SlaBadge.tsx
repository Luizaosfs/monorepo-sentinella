import { Badge } from '@/components/ui/badge';
import { COR_SLA, LABEL_SLA } from '@/types/focoRisco';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface Props {
  slaStatus: string | null | undefined;
  prazoEm: string | null | undefined;
  className?: string;
}

export function SlaBadge({ slaStatus, prazoEm, className }: Props) {
  if (!slaStatus || slaStatus === 'sem_sla') return null;

  const cor = COR_SLA[slaStatus] ?? '#888780';
  const label = LABEL_SLA[slaStatus] ?? slaStatus;
  const isVencido = slaStatus === 'vencido';

  let tempo: string | null = null;
  if (prazoEm) {
    try {
      tempo = formatDistanceToNow(new Date(prazoEm), { locale: ptBR, addSuffix: true });
    } catch {
      tempo = null;
    }
  }

  return (
    <Badge
      className={cn(isVencido && 'animate-pulse', className)}
      style={{ backgroundColor: cor, color: '#fff', border: 'none' }}
    >
      {label}{tempo ? ` · ${tempo}` : ''}
    </Badge>
  );
}
