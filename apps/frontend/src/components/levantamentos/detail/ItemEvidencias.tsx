import { Upload, Loader2, CameraIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRef, useState } from 'react';
import { resolveMediaUrl } from '@/lib/media';
import { useEvidenciasAtendimento } from '@/hooks/queries/useEvidenciasAtendimento';
import { toast } from 'sonner';

interface ItemEvidenciasProps {
  itemId: string;
  readonly?: boolean;
}

export function ItemEvidencias({ itemId, readonly = false }: ItemEvidenciasProps) {
  const { evidencias, addEvidencia, isAdding } = useEvidenciasAtendimento(itemId);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState<string | null>(null);
  const [pendingLegenda, setPendingLegenda] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file?.type.startsWith('image/')) {
      if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
      setPendingPreviewUrl(URL.createObjectURL(file));
      setPendingFile(file);
      setPendingLegenda('');
    }
    e.target.value = '';
  };

  const clearPending = () => {
    if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
    setPendingPreviewUrl(null);
    setPendingFile(null);
    setPendingLegenda('');
  };

  const handleSend = async () => {
    if (!pendingFile) return;
    try {
      await addEvidencia({ file: pendingFile, legenda: pendingLegenda || null });
      toast.success('Foto adicionada');
      clearPending();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao enviar foto');
    }
  };

  return (
    <Card className="rounded-2xl border-2 border-border bg-card shadow-none overflow-hidden">
      <CardContent className="px-3 py-2.5 sm:px-4 sm:py-3 space-y-2.5">
        <h4 className="text-xs font-semibold text-primary uppercase tracking-wider flex items-center gap-2">
          <CameraIcon className="w-4 h-4" />
          {readonly ? 'Fotos de evidência' : 'Evidência do atendimento'}
        </h4>

        {evidencias.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {evidencias.map((ev) => (
              <div
                key={ev.id}
                className="rounded-xl border border-border overflow-hidden bg-muted/30 aspect-square"
              >
                <img
                  src={resolveMediaUrl(ev.image_url)}
                  alt={ev.legenda || 'Evidência'}
                  className="w-full h-full object-cover"
                />
                {ev.legenda && (
                  <p className="text-[10px] px-2 py-1 bg-muted/80 text-muted-foreground line-clamp-2">
                    {ev.legenda}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {!readonly && (
          <>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileChange} />

            {!pendingFile ? (
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex-1 gap-2 rounded-xl border-border"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4" />
                  Da galeria
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex-1 gap-2 rounded-xl border-border"
                  onClick={() => cameraInputRef.current?.click()}
                >
                  <CameraIcon className="h-4 w-4" />
                  Tirar foto
                </Button>
              </div>
            ) : (
              <div className="space-y-2 rounded-xl border border-border bg-muted/20 p-2.5">
                <div className="flex gap-2">
                  {pendingPreviewUrl && (
                    <img src={pendingPreviewUrl} alt="" className="h-14 w-14 rounded-lg object-cover shrink-0" />
                  )}
                  <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                    <Label className="text-[10px] text-muted-foreground">Legenda (opcional)</Label>
                    <Input
                      value={pendingLegenda}
                      onChange={(e) => setPendingLegenda(e.target.value)}
                      placeholder="Descreva a foto..."
                      className="h-8 text-xs rounded-lg"
                    />
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs rounded-lg flex-1"
                        onClick={clearPending}
                        disabled={isAdding}
                      >
                        Cancelar
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        className="h-8 text-xs rounded-lg flex-1 gap-1"
                        onClick={handleSend}
                        disabled={isAdding}
                      >
                        {isAdding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                        Enviar
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {readonly && evidencias.length === 0 && (
          <p className="text-xs text-muted-foreground italic">Nenhuma foto registrada</p>
        )}
      </CardContent>
    </Card>
  );
}
