import { ZoomIn } from 'lucide-react';
import { ImageWithYoloOverlays } from '@/components/levantamentos/YoloImageOverlays';
import { useLevantamentoItemYoloOverlay } from '@/hooks/queries/useLevantamentoItemYoloOverlay';
import type { FocoRiscoPrioridade } from '@/types/database';
import { cn } from '@/lib/utils';

type Props = {
  imageUrl: string;
  /** levantamento_item de origem — necessário para bbox + detecções */
  itemId: string | null;
  prioridade: FocoRiscoPrioridade | null;
  variant: 'thumb' | 'dialog';
  onExpand?: () => void;
  className?: string;
};

/**
 * Miniatura (só foto, sem caixas) ou vista expandida com regiões YOLO.
 */
export function TriagemFocoImagemComYolo({
  imageUrl,
  itemId,
  prioridade,
  variant,
  onExpand,
  className,
}: Props) {
  const { data } = useLevantamentoItemYoloOverlay(itemId, {
    enabled: variant === 'dialog',
  });
  const detection_bbox = data?.detection_bbox ?? null;
  const detecoes = data?.detecoes ?? [];
  const prior = prioridade ?? null;

  const overlay = (
    <ImageWithYoloOverlays
      src={imageUrl}
      alt="Imagem do foco com detecções YOLO"
      primaryBbox={detection_bbox}
      detecoes={detecoes}
      prioridade={prior}
      showOverlays={variant === 'dialog'}
      className={cn(
        variant === 'thumb'
          ? 'max-h-[56px] sm:max-h-16 max-w-[88px] sm:max-w-24 mx-auto'
          : 'max-h-[min(82vh,880px)] w-full max-w-full',
      )}
    />
  );

  if (variant === 'thumb') {
    return (
      <button
        type="button"
        className={cn(
          'relative group rounded-lg overflow-hidden border border-border/60 shadow-sm bg-muted/40',
          'flex items-center justify-center w-[88px] h-[56px] sm:w-24 sm:h-16 shrink-0 p-0.5',
          className,
        )}
        onClick={onExpand}
      >
        <img
          src={imageUrl}
          alt="Imagem do foco"
          className="w-full h-full object-cover rounded-[6px]"
        />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors flex items-center justify-center pointer-events-none z-[3]">
          <ZoomIn className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-sm" />
        </div>
      </button>
    );
  }

  return (
    <div className={cn('flex flex-col items-center gap-2 w-full', className)}>
      <div className="flex items-center justify-center w-full rounded-lg border border-border/50 bg-black/20 p-2 min-h-[200px]">
        {overlay}
      </div>
      {(detecoes.length > 0 || detection_bbox?.bbox_norm) && (
        <p className="text-xs text-muted-foreground text-center px-2">
          Caixas tracejadas: todas as detecções do modelo; borda forte: região principal do foco (prioridade {prior ?? '—'}).
        </p>
      )}
    </div>
  );
}
