import { useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { api } from '@/services/api';
import { invokeUploadEvidencia } from '@/lib/uploadEvidencia';
import { Loader2, Upload, X } from 'lucide-react';
import { SlaOperacional, getSlaLocalLabel } from '@/types/sla';
import { cn } from '@/lib/utils';

export type FileWithPreview = { file: File; preview: string; legenda: string };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sla: SlaOperacional | null;
  usuarioId: string | null;
  onSuccess: () => void;
};

export function ConcluirSlaDialog({
  open,
  onOpenChange,
  sla,
  usuarioId,
  onSuccess,
}: Props) {
  const [observacao, setObservacao] = useState('');
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const clienteId = sla?.cliente_id ?? sla?.item?.run?.cliente_id ?? null;
  const itemId = sla?.item_id ?? null;

  const reset = () => {
    setObservacao('');
    setFiles([]);
  };

  const handleClose = (open: boolean) => {
    if (!open) reset();
    onOpenChange(open);
  };

  const handleAddFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files;
    if (!selected?.length) return;
    const newList: FileWithPreview[] = [];
    for (let i = 0; i < selected.length; i++) {
      const file = selected[i];
      if (!file.type.startsWith('image/')) continue;
      newList.push({
        file,
        preview: URL.createObjectURL(file),
        legenda: '',
      });
    }
    setFiles((prev) => [...prev, ...newList]);
    e.target.value = '';
  };

  const removeFile = (index: number) => {
    setFiles((prev) => {
      const next = [...prev];
      URL.revokeObjectURL(next[index].preview);
      next.splice(index, 1);
      return next;
    });
  };

  const setLegenda = (index: number, value: string) => {
    setFiles((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], legenda: value };
      return next;
    });
  };

  const ensureOperacaoAndConcluir = async (): Promise<string | null> => {
    if (!clienteId || !itemId || !usuarioId) return null;
    return api.operacoesSla.ensureAndConcluir({
      clienteId,
      itemId,
      usuarioId,
      prioridade: sla?.prioridade || 'Baixa',
      observacao: observacao || null,
    });
  };

  const uploadEvidencias = async (operacaoId: string) => {
    for (let i = 0; i < files.length; i++) {
      const { file, legenda } = files[i];
      const reader = new FileReader();
      const file_base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const result = await invokeUploadEvidencia({
        file_base64,
        filename: file.name,
        folder: operacaoId,
      });
      if ('error' in result) throw result.error;
      await api.operacoesSla.addEvidencia(operacaoId, result.url, legenda || null);
    }
  };

  const handleSubmit = async () => {
    if (!sla || !usuarioId || !clienteId || !itemId) {
      toast.error('Dados incompletos');
      return;
    }
    setSaving(true);
    try {
      const operacaoId = await ensureOperacaoAndConcluir();
      if (operacaoId && files.length > 0) await uploadEvidencias(operacaoId);
      toast.success('Atendimento concluído com sucesso');
      handleClose(false);
      onSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao concluir';
      toast.error(msg);
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg rounded-2xl">
        <DialogHeader>
          <DialogTitle>Concluir atendimento</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {sla && getSlaLocalLabel(sla) !== '—' && (
            <p className="text-sm text-muted-foreground">
              Local: <strong className="text-foreground">{getSlaLocalLabel(sla)}</strong>
            </p>
          )}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Observação (opcional)</Label>
            <Textarea
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Descreva o que foi feito no local..."
              rows={3}
              className="resize-none"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Fotos (Antes/Depois)</Label>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleAddFiles}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full gap-2"
              onClick={() => inputRef.current?.click()}
            >
              <Upload className="h-4 w-4" />
              Adicionar fotos
            </Button>
            {files.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
                {files.map((fw, i) => (
                  <div
                    key={i}
                    className="relative rounded-lg border border-border/60 overflow-hidden bg-muted/30 group"
                  >
                    <img
                      src={fw.preview}
                      alt=""
                      className="w-full aspect-square object-cover"
                    />
                    <button
                      type="button"
                      className="absolute top-1 right-1 w-6 h-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => removeFile(i)}
                    >
                      <X className="h-3 w-3" />
                    </button>
                    <input
                      type="text"
                      placeholder="Legenda (opcional)"
                      value={fw.legenda}
                      onChange={(e) => setLegenda(i, e.target.value)}
                      className="absolute bottom-0 left-0 right-0 text-[10px] px-2 py-1 bg-black/70 text-white placeholder:text-white/60 border-0 rounded-none"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={saving}
            className={cn('gap-2', 'bg-success hover:bg-success/90 text-success-foreground')}
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Concluir atendimento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
