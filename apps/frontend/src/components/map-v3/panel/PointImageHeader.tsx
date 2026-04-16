import { LevantamentoItem } from '@/types/database';
import { resolveMediaUrl } from '@/lib/media';
import { ImageIcon, Gauge, Mountain } from 'lucide-react';

interface PointImageHeaderProps {
  item: LevantamentoItem;
  onOpenImage?: (url: string) => void;
}

function confidencePercent(item: LevantamentoItem): number | null {
  const s = item.score_final ?? item.peso;
  if (s == null) return null;
  if (s >= 0 && s <= 100) return Math.round(s);
  return Math.min(100, Math.round(s));
}

export function PointImageHeader({ item, onOpenImage }: PointImageHeaderProps) {
  const imgUrl = resolveMediaUrl(item.image_url);
  const confidence = confidencePercent(item);
  const altitude = item.altitude_m != null ? `${item.altitude_m} m` : null;

  if (!imgUrl) {
    return (
      <div className="rounded-xl border border-border/60 bg-muted/40 h-48 flex flex-col items-center justify-center gap-2">
        <ImageIcon className="w-10 h-10 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Sem imagem</span>
      </div>
    );
  }

  const handleClick = () => onOpenImage && onOpenImage(imgUrl);
  const handleKeyDown = (e: React.KeyboardEvent) => e.key === 'Enter' && handleClick();

  return (
    <div
      className="relative rounded-xl overflow-hidden border border-border/60 bg-muted shadow-lg group cursor-pointer"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
    >
      <img
        src={imgUrl}
        alt="Detecção drone"
        className="w-full h-52 object-cover transition-transform duration-300 ease-out group-hover:scale-105"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent pointer-events-none" />
      <div className="absolute bottom-0 left-0 right-0 p-3 flex flex-wrap items-end justify-between gap-2 pointer-events-none">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-white/95 drop-shadow-sm capitalize">
            {item.item || 'Detecção'}
          </span>
          <div className="flex items-center gap-2 text-[11px] text-white/80">
            {confidence != null && (
              <span className="flex items-center gap-1">
                <Gauge className="w-3 h-3" />
                {confidence}% confiança
              </span>
            )}
            {altitude && (
              <span className="flex items-center gap-1">
                <Mountain className="w-3 h-3" />
                {altitude}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <span className="text-[10px] font-medium text-white/90 bg-black/40 backdrop-blur-sm px-2 py-1 rounded-md">
          Ver imagem
        </span>
      </div>
    </div>
  );
}
