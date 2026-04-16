import { LevantamentoItem } from '@/types/database';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { PointDetailsPanel } from './panel/PointDetailsPanel';
import { useIsMobile } from '@/hooks/use-mobile';

interface PointDetailsSheetProps {
  item: LevantamentoItem | null;
  open: boolean;
  onClose: () => void;
  onOpenImage?: (url: string) => void;
}

export function PointDetailsSheet({
  item,
  open,
  onClose,
  onOpenImage,
}: PointDetailsSheetProps) {
  const isMobile = useIsMobile();

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className={
          isMobile
            ? "h-[80vh] bg-background/95 border-t border-border/60 backdrop-blur-xl p-0 flex flex-col overflow-hidden rounded-t-2xl shadow-2xl"
            : "w-[400px] sm:max-w-[420px] bg-background/95 border-l border-border/60 backdrop-blur-xl p-0 flex flex-col overflow-hidden rounded-l-xl shadow-2xl"
        }
      >
        <SheetHeader className="sr-only">
          <SheetTitle>Detalhes do ponto</SheetTitle>
        </SheetHeader>
        <PointDetailsPanel
          item={item}
          onOpenImage={onOpenImage}
          onCreateTask={() => {}}
          onSendFieldTeam={() => {}}
          onMarkResolved={() => {}}
        />
      </SheetContent>
    </Sheet>
  );
}
