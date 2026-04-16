import { LevantamentoItem } from '@/types/database';
import { Plane, UserCheck, ClipboardList } from 'lucide-react';

interface OccurrenceTimelineProps {
  item: LevantamentoItem;
  className?: string;
}

type StepStatus = 'done' | 'current' | 'pending';

interface Step {
  id: string;
  label: string;
  icon: React.ElementType;
  status: StepStatus;
  detail?: string;
}

/** Build timeline steps from item (detection time = done; reviewed/created = placeholder) */
function getSteps(item: LevantamentoItem): Step[] {
  const detectedAt = item.data_hora ?? item.created_at;
  const dateStr = detectedAt
    ? new Date(detectedAt).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return [
    {
      id: 'detected',
      label: 'Detectado pelo drone',
      icon: Plane,
      status: 'done',
      detail: dateStr ?? '—',
    },
    {
      id: 'reviewed',
      label: 'Revisado por agente',
      icon: UserCheck,
      status: 'current',
      detail: 'Em análise',
    },
    {
      id: 'task',
      label: 'Tarefa criada',
      icon: ClipboardList,
      status: 'pending',
      detail: 'Pendente',
    },
  ];
}

export function OccurrenceTimeline({ item, className = '' }: OccurrenceTimelineProps) {
  const steps = getSteps(item);

  return (
    <div className={`rounded-xl border border-border/60 bg-card p-4 shadow-sm ${className}`}>
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">
        Histórico operacional
      </p>
      <ul className="space-y-0">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isLast = index === steps.length - 1;
          const lineClass =
            step.status === 'done'
              ? 'bg-primary/50'
              : step.status === 'current'
                ? 'bg-primary/30'
                : 'bg-border/60';
          const iconBg =
            step.status === 'done'
              ? 'bg-primary/20 text-primary'
              : step.status === 'current'
                ? 'bg-amber-500/20 text-amber-500 ring-2 ring-amber-500/30'
                : 'bg-muted text-muted-foreground';
          const textClass =
            step.status === 'done'
              ? 'text-foreground'
              : step.status === 'current'
                ? 'text-foreground font-medium'
                : 'text-muted-foreground';

          return (
            <li key={step.id} className="relative flex gap-3 pb-4 last:pb-0">
              {!isLast && (
                <div
                  className={`absolute left-[11px] top-6 w-0.5 h-[calc(100%+0.5rem)] ${lineClass} rounded-full`}
                />
              )}
              <div
                className={`relative z-0 shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-all duration-200 ${iconBg}`}
              >
                <Icon className="w-3 h-3" />
              </div>
              <div className="min-w-0 pt-0.5">
                <p className={`text-xs ${textClass}`}>{step.label}</p>
                {step.detail && (
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {step.detail}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
