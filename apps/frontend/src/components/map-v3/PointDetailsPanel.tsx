import { LevantamentoItem } from '@/types/database';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { resolveMediaUrl } from '@/lib/media';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  MapPin,
  Calendar,
  Image as ImageIcon,
  PlusCircle,
  CheckCircle2,
  ExternalLink,
  Navigation,
  BrainCircuit,
} from 'lucide-react';

interface PointDetailsPanelProps {
  item: LevantamentoItem | null;
  open: boolean;
  onClose: () => void;
  onOpenImage?: (url: string) => void;
}

function getRiskClass(risk: string | null): string {
  switch ((risk || '').toLowerCase()) {
    case 'critico':
    case 'alto':
      return 'bg-red-500/10 text-red-500 border-red-500/20';
    case 'medio':
      return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
    case 'baixo':
      return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
    default:
      return 'bg-muted text-muted-foreground border-border';
  }
}

export function PointDetailsPanel({
  item,
  open,
  onClose,
  onOpenImage,
}: PointDetailsPanelProps) {
  if (!item) return null;

  const imgUrl = resolveMediaUrl(item.image_url);
  const timestamp = item.data_hora ?? item.created_at;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        className="w-[380px] sm:max-w-[380px] bg-background border-l border-border/60 p-0 flex flex-col overflow-hidden rounded-l-xl"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>Detalhes do ponto</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col">
          {/* Drone image */}
          {imgUrl ? (
            <div
              className="relative w-full h-52 bg-muted shrink-0 cursor-pointer group"
              onClick={() => onOpenImage?.(imgUrl)}
              onKeyDown={(e) => e.key === 'Enter' && onOpenImage?.(imgUrl)}
              role="button"
              tabIndex={0}
            >
              <img
                src={imgUrl}
                alt="Detecção"
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <span className="flex items-center gap-2 text-white bg-black/50 px-3 py-1.5 rounded-full text-xs font-semibold">
                  <ImageIcon className="w-3.5 h-3.5" />
                  Ampliar
                </span>
              </div>
            </div>
          ) : (
              <div className="w-full h-40 bg-muted flex items-center justify-center shrink-0">
              <span className="text-sm text-muted-foreground">Sem imagem</span>
            </div>
          )}

          <div className="p-4 space-y-4">
            {/* Type detected */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
                Tipo detectado
              </p>
              <Badge variant="secondary" className="font-semibold capitalize">
                {item.item || 'Não informado'}
              </Badge>
            </div>

            {/* Risk classification */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
                Classificação de risco
              </p>
              <Badge
                variant="outline"
                className={`capitalize font-semibold ${getRiskClass(item.risco)}`}
              >
                {item.risco || 'Sem classificação'}
              </Badge>
            </div>

            {/* Score IA */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
                Score IA
              </p>
              <p className="text-sm font-bold text-foreground flex items-center gap-1.5">
                <BrainCircuit className="w-4 h-4 text-primary" />
                {item.score_final ?? item.peso ?? 'N/A'}
              </p>
            </div>

            {/* Timestamp */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
                Data / Hora
              </p>
              <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
                {timestamp
                  ? new Date(timestamp).toLocaleString('pt-BR')
                  : 'Não informado'}
              </p>
            </div>

            {/* Address */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
                Endereço
              </p>
              <p className="text-sm text-muted-foreground flex items-start gap-1.5">
                <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-primary" />
                {item.endereco_curto || item.endereco_completo || 'Não informado'}
              </p>
            </div>

            {/* Links: Google Maps, Waze */}
            <div className="flex gap-2 pt-2">
              {item.maps ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 rounded-xl border-border/60 text-xs h-9 hover:bg-muted"
                  onClick={() => window.open(item.maps!, '_blank')}
                >
                  <ExternalLink className="w-3.5 h-3.5 mr-2 text-blue-500" />
                  Google Maps
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                    className="flex-1 rounded-xl border-border/60 text-xs h-9 opacity-50"
                  disabled
                >
                  <ExternalLink className="w-3.5 h-3.5 mr-2" />
                  Maps
                </Button>
              )}
              {item.waze ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 rounded-xl border-border/60 text-xs h-9 hover:bg-muted"
                  onClick={() => window.open(item.waze!, '_blank')}
                >
                  <Navigation className="w-3.5 h-3.5 mr-2 text-teal-500" />
                  Waze
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                    className="flex-1 rounded-xl border-border/60 text-xs h-9 opacity-50"
                  disabled
                >
                  <Navigation className="w-3.5 h-3.5 mr-2" />
                  Waze
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Actions footer */}
        <div className="p-4 border-t border-border/60 bg-muted/40 space-y-2 shrink-0">
          <Button
            className="w-full rounded-xl h-10 font-semibold bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => {}}
          >
            <PlusCircle className="w-4 h-4 mr-2" />
            Criar tarefa
          </Button>
          <Button
            variant="outline"
            className="w-full rounded-xl h-10 font-semibold border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10"
            onClick={() => {}}
          >
            <CheckCircle2 className="w-4 h-4 mr-2" />
            Marcar resolvido
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
