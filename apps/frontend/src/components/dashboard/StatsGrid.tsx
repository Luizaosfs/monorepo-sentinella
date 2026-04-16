import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { LucideIcon, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  color: string;
  index: number;
  tooltip?: string;
  onClick?: () => void;
}

export const StatCard = ({ title, value, icon: Icon, color, index, tooltip, onClick }: StatCardProps) => {
  const card = (
    <Card
      className={cn(
        "overflow-hidden rounded-2xl shadow-sm border-border/60 bg-card hover:bg-muted/10 transition-colors animate-fade-in group relative",
        onClick && "cursor-pointer hover:ring-2 hover:ring-primary/30"
      )}
      style={{ animationDelay: `${0.05 * (index + 1)}s`, opacity: 0 }}
      onClick={onClick}
      role={onClick ? "button" : undefined}
    >
      {tooltip && <Info className="absolute top-3 right-3 w-3 h-3 text-muted-foreground/40" />}
      <CardContent className="p-5 flex flex-col gap-4">
        <div className="flex justify-between items-start">
          <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            {title}
          </span>
          <div className={cn(
            "h-8 w-8 rounded-xl flex items-center justify-center bg-primary/10 shrink-0",
            color.replace('text-', 'bg-').replace('primary', 'primary/10').replace('destructive', 'destructive/10')
          )}>
            <Icon className={cn("h-4 w-4", color)} />
          </div>
        </div>
        <div>
          <div className="text-3xl font-black tracking-tight text-foreground transition-all duration-300">
            {value}
          </div>
          <div className="text-xs font-semibold text-muted-foreground mt-1 flex items-center gap-1.5">
            <span className="text-emerald-500 font-bold">+2 hoje</span>
            <span className="opacity-50">vs semana passada</span>
          </div>
        </div>
        <div className="h-1.5 w-full bg-muted/40 rounded-full overflow-hidden mt-2">
          <div className={cn("h-full rounded-full transition-all duration-1000 delay-300",
            color.includes('destructive') ? 'bg-destructive' : 'bg-primary'
          )} style={{ width: '65%' }} />
        </div>
      </CardContent>
    </Card>
  );
  if (!tooltip) return card;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{card}</TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-[220px] text-xs leading-relaxed">{tooltip}</TooltipContent>
    </Tooltip>
  );
};

interface StatsGridProps {
  stats: Omit<StatCardProps, 'index'>[];
}


export const StatsGrid = ({ stats }: StatsGridProps) => (
  <TooltipProvider delayDuration={300}>
    <div className="grid gap-4 lg:gap-6 grid-cols-2 lg:grid-cols-4">
      {stats.map((card, index) => (
        <StatCard key={card.title} {...card} index={index} />
      ))}
    </div>
  </TooltipProvider>
);
