import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { X, ZoomIn, Download } from "lucide-react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string | null;
}

export function ImagePreviewModal({ isOpen, onClose, imageUrl }: Props) {
  if (!imageUrl) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden bg-black/95 border-border/20 rounded-2xl shadow-2xl backdrop-blur-xl">
        <DialogTitle className="sr-only">Pré-visualização da imagem</DialogTitle>
        <div className="relative group w-full h-[80vh] flex items-center justify-center">
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 z-50 w-10 h-10 flex items-center justify-center rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-md border border-white/10 text-white/70 hover:text-white transition-all duration-300"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="absolute top-4 left-4 z-50 flex gap-2">
            <button className="h-10 px-4 flex items-center gap-2 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-md border border-white/10 text-white/80 hover:text-white transition-all duration-300 text-xs font-bold tracking-wide">
              <ZoomIn className="w-4 h-4" />
              Zoom Original
            </button>
            <a 
              href={imageUrl} 
              download 
              target="_blank" 
              rel="noreferrer"
              className="h-10 px-4 flex items-center gap-2 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-md border border-white/10 text-white/80 hover:text-white transition-all duration-300 text-xs font-bold tracking-wide"
            >
              <Download className="w-4 h-4" />
              Baixar Alta Res.
            </a>
          </div>

          <img 
            src={imageUrl} 
            alt="Preview" 
            className="w-full h-full object-contain cursor-crosshair transition-transform duration-300 hover:scale-110"
          />

          {/* AI Bounding Box overlay */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="relative">
              <div 
                className="absolute inset-0 w-48 h-48 border-[3px] border-primary/80 border-dashed rounded-xl"
                style={{ top: 'calc(50% - 96px)', left: 'calc(50% - 96px)' }}
              >
                <div className="absolute -top-6 left-0 bg-primary text-primary-foreground px-2 py-0.5 text-[10px] font-black tracking-widest uppercase rounded">
                  88% Confiança
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
