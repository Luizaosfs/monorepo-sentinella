import { PenLine, Trash2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useSignatureCanvas } from '@/hooks/useSignatureCanvas';
import { toast } from 'sonner';

interface Props {
  onCapture: (dataUrl: string) => void;
  onClear?: () => void;
  label?: string;
}

export function AssinaturaDigital({ onCapture, onClear, label = 'Assinatura do responsável' }: Props) {
  const { canvasRef, isEmpty, clear, toDataURL } = useSignatureCanvas();

  function handleConfirm() {
    const dataUrl = toDataURL();
    if (dataUrl && !isEmpty) {
      onCapture(dataUrl);
      toast.success('Assinatura capturada com sucesso.');
      return;
    }
    toast.warning('Desenhe a assinatura antes de confirmar.');
  }

  function handleClear() {
    clear();
    onClear?.();
    toast.info('Assinatura removida.');
  }

  return (
    <Card className="rounded-2xl border-border">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <PenLine className="w-4 h-4 text-primary" />
          <p className="text-xs font-semibold text-primary uppercase tracking-wider">{label}</p>
        </div>

        <div className="relative rounded-xl border-2 border-dashed border-border bg-white dark:bg-slate-900 overflow-hidden touch-none">
          <canvas
            ref={canvasRef}
            width={600}
            height={160}
            className="w-full h-40 cursor-crosshair"
            style={{ touchAction: 'none' }}
          />
          {isEmpty && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <p className="text-sm text-muted-foreground/50 select-none">Assine aqui</p>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 rounded-xl gap-1.5"
            onClick={handleClear}
            disabled={isEmpty}
          >
            <Trash2 className="w-3.5 h-3.5" />
            Limpar
          </Button>
          <Button
            size="sm"
            className="flex-1 rounded-xl gap-1.5"
            onClick={handleConfirm}
            disabled={isEmpty}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Confirmar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
