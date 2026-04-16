import { Eye, AlertTriangle, Wrench, Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { usePainelSLAResumo } from '@/hooks/queries/usePainelSLAResumo';
import { cn } from '@/lib/utils';

interface StatItemProps {
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
  pulse?: boolean;
}

function StatItem({ label, value, icon: Icon, color, pulse }: StatItemProps) {
  return (
    <Card className="rounded-xl border border-border/60 shadow-sm">
      <CardContent className="p-4 flex items-center gap-3">
        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', color)}>
          <Icon className={cn('w-5 h-5', pulse && value > 0 && 'animate-pulse')} />
        </div>
        <div>
          <p className="text-2xl font-black text-foreground">{value}</p>
          <p className="text-xs text-muted-foreground font-medium">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function PainelSLAResumo() {
  const { data, isLoading } = usePainelSLAResumo();

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i} className="rounded-xl">
            <CardContent className="p-4">
              <Skeleton className="h-10 w-10 rounded-xl mb-2" />
              <Skeleton className="h-7 w-12 mb-1" />
              <Skeleton className="h-3 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const items = [
    {
      label: 'Suspeitas',
      value: data?.suspeitas ?? 0,
      icon: Eye,
      color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
    },
    {
      label: 'Confirmados',
      value: data?.confirmados ?? 0,
      icon: AlertTriangle,
      color: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400',
    },
    {
      label: 'Em tratamento',
      value: data?.em_tratamento ?? 0,
      icon: Wrench,
      color: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
    },
    {
      label: 'SLA vencido',
      value: data?.sla_vencidos ?? 0,
      icon: Clock,
      color: 'bg-destructive/10 text-destructive',
      pulse: true,
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {items.map((item) => (
        <StatItem key={item.label} {...item} />
      ))}
    </div>
  );
}
