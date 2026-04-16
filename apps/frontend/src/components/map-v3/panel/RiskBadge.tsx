import { Badge } from '@/components/ui/badge';

const RISK_STYLES: Record<string, string> = {
  critico: 'bg-red-500/15 text-red-500 border-red-500/30 shadow-sm shadow-red-500/10',
  alto: 'bg-red-500/15 text-red-500 border-red-500/30 shadow-sm shadow-red-500/10',
  medio: 'bg-orange-500/15 text-orange-500 border-orange-500/30 shadow-sm shadow-orange-500/10',
  baixo: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30 shadow-sm shadow-emerald-500/10',
};

function getRiskStyle(risk: string | null): string {
  const key = (risk || '').toLowerCase();
  return RISK_STYLES[key] ?? 'bg-muted/40 text-muted-foreground border-border/60';
}

interface RiskBadgeProps {
  risk: string | null;
  confidencePercent?: number | null;
  className?: string;
}

export function RiskBadge({ risk, confidencePercent, className = '' }: RiskBadgeProps) {
  const style = getRiskStyle(risk);

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <Badge
        variant="outline"
        className={`capitalize font-semibold text-xs px-2.5 py-1 transition-all duration-200 ${style}`}
      >
        {risk || 'Não classificado'}
      </Badge>
      {confidencePercent != null && (
        <Badge
          variant="outline"
          className="bg-muted text-muted-foreground border-border/60 text-xs font-mono px-2.5 py-1"
        >
          {confidencePercent}% IA
        </Badge>
      )}
    </div>
  );
}
