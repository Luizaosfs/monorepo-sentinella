import { CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface StepInfo {
  label: string;
  status: 'done' | 'attention' | 'pending';
  detail?: string;
}

interface Props {
  steps: StepInfo[];
}

export function FluxoOperacionalStepper({ steps }: Props) {
  return (
    <div className="flex items-center overflow-x-auto rounded-xl border bg-card shadow-sm px-2 py-1.5 gap-0 min-h-[52px]">
      {steps.map((step, i) => (
        <div key={step.label} className="flex items-center shrink-0">
          <div className={cn(
            'flex items-center gap-2 px-2.5 py-1.5 rounded-lg transition-colors',
            step.status === 'done' && 'bg-emerald-50 dark:bg-emerald-950/30',
            step.status === 'attention' && 'bg-amber-50 dark:bg-amber-950/30',
          )}>
            {/* Status circle */}
            <div className={cn(
              'flex h-5 w-5 items-center justify-center rounded-full shrink-0',
              step.status === 'done'
                ? 'bg-emerald-500'
                : step.status === 'attention'
                  ? 'bg-amber-400'
                  : 'bg-muted border border-border',
            )}>
              {step.status === 'done' ? (
                <CheckCircle2 className="h-3 w-3 text-white" />
              ) : step.status === 'attention' ? (
                <AlertCircle className="h-3 w-3 text-white" />
              ) : (
                <span className="text-[9px] font-bold text-muted-foreground">{i + 1}</span>
              )}
            </div>
            {/* Label + detail */}
            <div className="flex flex-col">
              <span className={cn(
                'text-[10px] font-semibold leading-none',
                step.status === 'done'
                  ? 'text-emerald-700 dark:text-emerald-400'
                  : step.status === 'attention'
                    ? 'text-amber-700 dark:text-amber-400'
                    : 'text-muted-foreground/40',
              )}>
                {step.label}
              </span>
              {step.detail && (
                <span className="text-[9px] text-muted-foreground/55 leading-none mt-1 whitespace-nowrap">
                  {step.detail}
                </span>
              )}
            </div>
          </div>
          {/* Connector */}
          {i < steps.length - 1 && (
            <div className={cn(
              'h-px shrink-0 mx-1',
              step.status === 'done'
                ? 'w-5 bg-emerald-300/70 dark:bg-emerald-700'
                : 'w-4 bg-border/50',
            )} />
          )}
        </div>
      ))}
    </div>
  );
}
