import { ArrowLeft, ClipboardList } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface LevantamentoHeaderProps {
  titulo: string;
  dataVoo: string;
  onBack: () => void;
}

export const LevantamentoHeader = ({ titulo, dataVoo, onBack }: LevantamentoHeaderProps) => {
  return (
    <Card className="overflow-hidden rounded-sm border border-sidebar-border bg-sidebar text-sidebar-foreground shadow-sm shrink-0 mb-3">
      <div className="flex items-center justify-between px-3 py-2 sm:px-4 lg:px-5 lg:py-2.5">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8 shrink-0 text-sidebar-foreground hover:bg-sidebar-accent" onClick={onBack}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="min-w-0">
            <h2 className="text-xs sm:text-sm lg:text-base font-bold text-sidebar-primary truncate">{titulo}</h2>
            <p className="text-[10px] sm:text-[11px] lg:text-xs text-sidebar-foreground/60 truncate">
              {new Date(dataVoo).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
            </p>
          </div>
        </div>
        <div className="hidden sm:flex h-8 w-8 sm:h-9 sm:w-9 lg:h-10 lg:w-10 items-center justify-center rounded-sm bg-sidebar-accent shrink-0 ml-3">
          <ClipboardList className="h-4 w-4 lg:h-5 lg:w-5 text-sidebar-primary" />
        </div>
      </div>
    </Card>
  );
};
