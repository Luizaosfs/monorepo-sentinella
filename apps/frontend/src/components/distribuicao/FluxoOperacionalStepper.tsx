import { CheckCircle2, AlertCircle, Circle } from 'lucide-react';
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
    <div className="flex items-stretch overflow-x-auto rounded-xl border bg-card px-1 py-1 gap-0 shadow-sm">
      {steps.map((step, i) => (
        <div key={step.label} className="flex items-center shrink-0">
          <div
            className={cn(
              'flex flex-col items-center gap-0.5 px-3 py-2 min-w-[80px] rounded-lg transition-colors',
              step.status === 'done' && 'bg-emerald-50 dark:bg-emerald-950/40',
              step.status === 'attention' && 'bg-amber-50 dark:bg-amber-950/40',
            )}
          >
            <div className="flex items-center gap-1">
              {step.status === 'done' ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
              ) : step.status === 'attention' ? (
                <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
              ) : (
                <Circle className="h-3.5 w-3.5 text-muted-foreground/30 shrink-0" />
              )}
              <span
                className={cn(
                  'text-[10px] font-semibold leading-tight',
                  step.status === 'done'
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : step.status === 'attention'
                      ? 'text-amber-700 dark:text-amber-400'
                      : 'text-muted-foreground/35',
                )}
              >
                {step.label}
              </span>
            </div>
            {step.detail && (
              <span className="text-[9px] text-muted-foreground/60 text-center leading-tight">
                {step.detail}
              </span>
            )}
          </div>
          {i < steps.length - 1 && (
            <div
              className={cn(
                'h-px w-4 shrink-0',
                step.status === 'done' ? 'bg-emerald-300 dark:bg-emerald-700' : 'bg-border',
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}
