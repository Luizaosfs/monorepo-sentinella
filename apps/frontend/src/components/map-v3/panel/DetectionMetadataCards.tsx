import { LevantamentoItem } from '@/types/database';
import { Calendar, Plane, BrainCircuit } from 'lucide-react';

interface DetectionMetadataCardsProps {
  item: LevantamentoItem;
  className?: string;
}

function SmallCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/40 p-3 min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
        {label}
      </p>
      <p className="text-xs font-medium text-foreground flex items-center gap-1.5 truncate">
        <Icon className="w-3.5 h-3.5 text-primary shrink-0" />
        {value}
      </p>
    </div>
  );
}

export function DetectionMetadataCards({ item, className = '' }: DetectionMetadataCardsProps) {
  const timestamp = item.data_hora ?? item.created_at;
  const dateStr = timestamp
    ? new Date(timestamp).toLocaleString('pt-BR')
    : '—';
  const flightId =
    item.levantamento?.titulo ?? `Voo ${(item.levantamento_id ?? '').slice(0, 8)}`;
  const score = item.score_final ?? item.peso ?? '—';

  return (
    <div className={`grid grid-cols-3 gap-2 ${className}`}>
      <SmallCard icon={Calendar} label="Data/Hora" value={dateStr} />
      <SmallCard icon={Plane} label="Voo" value={flightId} />
      <SmallCard icon={BrainCircuit} label="Score IA" value={String(score)} />
    </div>
  );
}
