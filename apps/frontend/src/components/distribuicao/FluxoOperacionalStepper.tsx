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
    <div className="flex items-center overflow-x-auto rounded-xl border bg-muted/20 px-2 py-1.5 gap-0">
      {steps.map((step, i) => (
        <div key={step.label} className="flex items-center shrink-0">
          <div className="flex flex-col items-center gap-0.5 px-3 py-1 min-w-[76px]">
            <div className="flex items-center gap-1">
              {step.status === 'done' ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
              ) : step.status === 'attention' ? (
                <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
              ) : (
                <Circle className="h-3.5 w-3.5 text-muted-foreground/35 shrink-0" />
              )}
              <span
                className={cn(
                  'text-[10px] font-semibold leading-tight',
                  step.status === 'done'
                    ? 'text-emerald-600'
                    : step.status === 'attention'
                      ? 'text-amber-600'
                      : 'text-muted-foreground/40',
                )}
              >
                {step.label}
              </span>
            </div>
            {step.detail && (
              <span className="text-[9px] text-muted-foreground/55 text-center leading-tight">
                {step.detail}
              </span>
            )}
          </div>
          {i < steps.length - 1 && (
            <div
              className={cn(
                'h-px w-5 shrink-0',
                step.status === 'done' ? 'bg-emerald-200 dark:bg-emerald-800' : 'bg-border',
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}
