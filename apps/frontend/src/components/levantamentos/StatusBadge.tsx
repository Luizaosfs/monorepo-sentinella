import { Badge } from '@/components/ui/badge';

interface StatusBadgeProps {
  type: 'risco' | 'prioridade';
  value: string | null;
  className?: string;
}

const getRiscoStyles = (risco: string | null) => {
  const r = (risco || '').toLowerCase();
  if (r === 'critico') return 'bg-destructive/15 text-destructive border-destructive/20';
  if (r === 'alto') return 'bg-destructive/10 text-destructive border-destructive/15';
  if (r === 'medio') return 'bg-warning/10 text-warning-foreground border-warning/20';
  if (r === 'baixo') return 'bg-success/10 text-success border-success/20';
  return 'bg-muted text-muted-foreground border-border';
};

const getPrioridadeStyles = (p: string | null) => {
  const r = (p || '').toLowerCase();
  if (r === 'urgente') return 'bg-destructive/15 text-destructive';
  if (r === 'alta') return 'bg-destructive/10 text-destructive';
  if (r === 'media') return 'bg-warning/10 text-warning-foreground';
  if (r === 'baixa') return 'bg-success/10 text-success';
  return 'bg-muted text-muted-foreground';
};

export const StatusBadge = ({ type, value, className = '' }: StatusBadgeProps) => {
  const styles = type === 'risco' ? getRiscoStyles(value) : getPrioridadeStyles(value);
  const variant = type === 'risco' ? 'outline' : 'default';
  
  return (
    <Badge 
      variant={variant} 
      className={`text-[10px] sm:text-xs capitalize ${type === 'prioridade' ? 'border-0' : ''} ${styles} ${className}`}
    >
      {value || '—'}
    </Badge>
  );
};
