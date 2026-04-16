import { LevantamentoItem } from '@/types/database';
import { PointImageHeader } from './PointImageHeader';
import { RiskBadge } from './RiskBadge';
import { LocationCard } from './LocationCard';
import { DetectionMetadataCards } from './DetectionMetadataCards';
import { SuggestedActionCard } from './SuggestedActionCard';
import { OperationalActions } from './OperationalActions';
import { OccurrenceTimeline } from './OccurrenceTimeline';
import { Separator } from '@/components/ui/separator';

function confidencePercent(item: LevantamentoItem): number | null {
  const s = item.score_final ?? item.peso;
  if (s == null) return null;
  if (s >= 0 && s <= 100) return Math.round(s);
  return Math.min(100, Math.round(s));
}

interface PointDetailsPanelProps {
  item: LevantamentoItem | null;
  onOpenImage?: (url: string) => void;
  onCreateTask?: () => void;
  onSendFieldTeam?: () => void;
  onMarkResolved?: () => void;
}

export function PointDetailsPanel({
  item,
  onOpenImage,
  onCreateTask,
  onSendFieldTeam,
  onMarkResolved,
}: PointDetailsPanelProps) {
  if (!item) return null;

  const confidence = confidencePercent(item);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-5">
        {/* Section 1 — Image with overlay */}
        <PointImageHeader item={item} onOpenImage={onOpenImage} />

        {/* Section 2 — Risk summary */}
        <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
            Risco
          </p>
          <RiskBadge risk={item.risco} confidencePercent={confidence} />
        </div>

        {/* Section 3 — Location */}
        <LocationCard item={item} />

        {/* Section 4 — Detection metadata */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
            Metadados da detecção
          </p>
          <DetectionMetadataCards item={item} />
        </div>

        <Separator className="bg-border/60" />

        {/* Section 5 — Suggested action */}
        <SuggestedActionCard item={item} />

        {/* Section 6 — Operational actions (moved to footer in sheet) */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
            Ações operacionais
          </p>
          <OperationalActions
            onCreateTask={onCreateTask}
            onSendFieldTeam={onSendFieldTeam}
            onMarkResolved={onMarkResolved}
          />
        </div>

        {/* Section 7 — Timeline */}
        <OccurrenceTimeline item={item} />
      </div>
    </div>
  );
}
