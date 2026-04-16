import { Mic, Square, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useRef, useState } from 'react';
import { api } from '@/services/api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const SpeechRecognitionAPI =
  typeof window !== 'undefined'
    ? ((window as Record<string, unknown>).SpeechRecognition || (window as Record<string, unknown>).webkitSpeechRecognition)
    : undefined;

interface ItemObservacaoProps {
  itemId: string;
  initialValue: string;
  onSaved: (value: string | null) => void;
  /** Called when a voice command triggers status change */
  onVoiceStatusChange: (status: 'resolvido') => void;
  /** Called when voice commands navigate to next/prev item */
  onVoiceNext?: () => void;
  onVoicePrev?: () => void;
}

export function ItemObservacao({
  itemId,
  initialValue,
  onSaved,
  onVoiceStatusChange,
  onVoiceNext,
  onVoicePrev,
}: ItemObservacaoProps) {
  const [observacaoLocal, setObservacaoLocal] = useState(initialValue);
  const [isSaving, setSaving] = useState(false);
  const [isRecording, setRecording] = useState(false);
  const recognitionRef = useRef<InstanceType<NonNullable<typeof SpeechRecognitionAPI>> | null>(null);

  const speechOk = Boolean(SpeechRecognitionAPI);

  const startRecording = () => {
    if (!SpeechRecognitionAPI) return;
    try {
      const rec = new SpeechRecognitionAPI();
      rec.lang = 'pt-BR';
      rec.continuous = true;
      rec.interimResults = true;
      rec.onresult = (e: SpeechRecognitionEvent) => {
        // Iterar apenas sobre resultados novos a partir de e.resultIndex,
        // evitando duplicação no Android Chrome (e.results é cumulativo).
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const result = e.results[i];
          if (!result.isFinal) continue;
          const transcript = result[0].transcript.toLowerCase().trim();
          if (transcript.includes('marcar como resolvido') || transcript.includes('resolver item')) {
            onVoiceStatusChange('resolvido');
            toast.info('Status alterado para Resolvido via voz.');
            continue;
          }
          if (transcript.includes('próximo item') || transcript.includes('proximo item')) {
            onVoiceNext?.();
            continue;
          }
          if (transcript.includes('item anterior') || transcript.includes('voltar item')) {
            onVoicePrev?.();
            continue;
          }
          setObservacaoLocal((prev) => (prev ? `${prev} ${transcript}` : transcript));
        }
      };
      rec.onerror = () => setRecording(false);
      rec.onend = () => setRecording(false);
      recognitionRef.current = rec;
      rec.start();
      setRecording(true);
    } catch {
      toast.error('Microfone não disponível');
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch { /* noop */ }
      recognitionRef.current = null;
    }
    setRecording(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const value = observacaoLocal.trim() || null;
      await api.itens.updateObservacaoAtendimento(itemId, value);
      toast.success('Observação salva');
      onSaved(value);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="rounded-2xl border-2 border-border bg-card shadow-none overflow-hidden">
      <CardContent className="px-3 py-2.5 sm:px-4 sm:py-3 space-y-2.5">
        <h4 className="text-xs font-semibold text-primary uppercase tracking-wider">Observação do atendimento</h4>
        <Textarea
          value={observacaoLocal}
          onChange={(e) => setObservacaoLocal(e.target.value)}
          placeholder="Digite ou use o microfone para descrever o que foi feito no local..."
          rows={3}
          className="resize-none text-sm rounded-xl border-border"
        />
        <div className="flex gap-2">
          {speechOk && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn(
                'gap-2 rounded-xl border-border flex-1',
                isRecording && 'border-destructive bg-destructive/10 text-destructive'
              )}
              onClick={isRecording ? stopRecording : startRecording}
            >
              {isRecording ? (
                <>
                  <Square className="h-4 w-4" />
                  Parar gravação
                </>
              ) : (
                <>
                  <Mic className="h-4 w-4" />
                  Gravar com microfone
                </>
              )}
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            className="rounded-xl flex-1 gap-1"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Salvar observação
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
