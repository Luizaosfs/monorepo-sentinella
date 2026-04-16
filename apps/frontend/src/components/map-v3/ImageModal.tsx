import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { X, ZoomIn, Download } from "lucide-react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string | null;
}

export function ImageModal({ isOpen, onClose, imageUrl }: Props) {
  if (!imageUrl) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden bg-black/95 border-border/20 rounded-2xl shadow-2xl backdrop-blur-xl">
        <DialogTitle className="sr-only">Visualizar imagem</DialogTitle>
        <div className="relative group w-full h-[80vh] flex items-center justify-center">
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 z-[999] w-10 h-10 flex items-center justify-center rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-md border border-white/10 text-white/70 hover:text-white transition-all duration-300"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="absolute top-4 left-4 z-[999] flex gap-2">
            <button className="h-10 px-4 flex items-center gap-2 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-md border border-white/10 text-white/80 hover:text-white transition-all duration-300 text-xs font-bold tracking-wide">
              <ZoomIn className="w-4 h-4" />
              Ver original
            </button>
            <a 
              href={imageUrl} 
              download 
              target="_blank" 
              rel="noreferrer"
              className="h-10 px-4 flex items-center gap-2 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-md border border-white/10 text-white/80 hover:text-white transition-all duration-300 text-xs font-bold tracking-wide"
            >
              <Download className="w-4 h-4" />
              Download
            </a>
          </div>

          <img 
            src={imageUrl} 
            alt="Imagem detalhada" 
            className="w-full h-full object-contain cursor-crosshair transition-transform duration-300 hover:scale-[1.05]"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
