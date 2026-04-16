import { LevantamentoItem } from '@/types/database';
import { Lightbulb } from 'lucide-react';

interface SuggestedActionCardProps {
  item: LevantamentoItem;
  className?: string;
}

/** Map detection type/risk to a suggested action (placeholder logic; can be driven by API later) */
function getSuggestedAction(item: LevantamentoItem): string {
  const type = (item.item || '').toLowerCase();
  const risk = (item.risco || '').toLowerCase();
  if (type.includes('agua') || type.includes('água') || type.includes('poca') || type.includes('poça')) {
    return 'Drenar água e aplicar larvicida biológico.';
  }
  if (type.includes('lixo') || type.includes('entulho')) {
    return 'Remover resíduos e registrar local para coleta.';
  }
  if (risk === 'alto' || risk === 'critico') {
    return 'Vistoria presencial e correção no prazo de SLA.';
  }
  if (risk === 'medio') {
    return 'Agendar vistoria e aplicar tratamento preventivo.';
  }
  return 'Registrar e monitorar em próxima campanha.';
}

export function SuggestedActionCard({ item, className = '' }: SuggestedActionCardProps) {
  const action = getSuggestedAction(item);

  return (
    <div
      className={`rounded-xl border border-border/60 bg-card p-4 shadow-sm animate-in fade-in duration-200 ${className}`}
    >
      <div className="flex gap-3">
        <div className="shrink-0 w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
          <Lightbulb className="w-4 h-4 text-amber-400" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
            Ação sugerida
          </p>
          <p className="text-sm font-medium text-foreground leading-snug">
            {action}
          </p>
        </div>
      </div>
    </div>
  );
}
