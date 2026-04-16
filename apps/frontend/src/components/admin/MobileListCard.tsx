import { ReactNode, memo } from 'react';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2 } from 'lucide-react';

interface MobileListCardField {
  label: string;
  value: ReactNode;
}

interface MobileListCardProps {
  title: string;
  fields: MobileListCardField[];
  badges?: ReactNode;
  onEdit?: () => void;
  onDelete?: () => void;
  extra?: ReactNode;
}

const MobileListCard = memo(function MobileListCard({ title, fields, badges, onEdit, onDelete, extra }: MobileListCardProps) {
  return (
  <div
    className={`rounded-xl border border-cardBorder bg-card p-4 space-y-3 shadow-sm ${onEdit ? 'cursor-pointer hover:bg-muted/50 active:bg-muted transition-colors' : ''}`}
    onClick={onEdit}
  >
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-sm text-foreground truncate">{title}</p>
        {badges && <div className="flex flex-wrap gap-1.5 mt-1.5">{badges}</div>}
      </div>
      <div className="flex gap-1 shrink-0 px-1 py-1">
        {onEdit && (
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); onEdit(); }}>
            <Pencil className="w-3.5 h-3.5" />
          </Button>
        )}
        {onDelete && (
          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); onDelete(); }}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>
    </div>
    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
      {fields.map((f, i) => (
        <div key={i} className="min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{f.label}</p>
          <p className="text-xs text-foreground truncate">{f.value || '—'}</p>
        </div>
      ))}
    </div>
    {extra}
  </div>
  );
});

export default MobileListCard;
