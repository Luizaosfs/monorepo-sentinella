import { CheckCircle2, Circle, CircleDot, Loader2, LocateFixed, Mic, Square, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { StatusAtendimento } from '@/types/database';
import { useEffect, useRef, useState } from 'react';
import { ItemCheckinButton } from './ItemCheckinButton';

const SpeechRecognitionAPI =
  typeof window !== 'undefined'
    ? ((window as unknown as { SpeechRecognition?: new () => SpeechRecognition; webkitSpeechRecognition?: new () => SpeechRecognition }).SpeechRecognition ||
        (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognition }).webkitSpeechRecognition)
    : undefined;

export const STATUS_CONFIG: Record<StatusAtendimento, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  pendente:       { label: 'Pendente',       icon: <Circle className="w-4 h-4" />,       color: 'text-muted-foreground', bg: 'bg-muted/40' },
  em_atendimento: { label: 'Em atendimento', icon: <CircleDot className="w-4 h-4" />,    color: 'text-blue-600',         bg: 'bg-blue-50 dark:bg-blue-950/40' },
  resolvido:      { label: 'Resolvido',      icon: <CheckCircle2 className="w-4 h-4" />, color: 'text-emerald-600',      bg: 'bg-emerald-50 dark:bg-emerald-950/40' },
};

interface ItemPlanoAcaoProps {
  itemId: string;
  statusLocal: StatusAtendimento;
  acaoAplicadaLocal: string;
  checkinEm: string | null;
  isSaving: boolean;
  onStatusChange: (status: StatusAtendimento) => void;
  onAcaoChange: (acao: string) => void;
  onCheckinRegistered: (isoDate: string) => void;
  onSave: () => void;
  onIniciarAtendimento: () => void;
  onConfirmarResolucao: () => void;
  onCancelarAtendimento: () => void;
}

function OQueFoiFeito({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [isRecording, setRecording] = useState(false);
  const recognitionRef = useRef<InstanceType<NonNullable<typeof SpeechRecognitionAPI>> | null>(null);
  const valueRef = useRef(value);
  useEffect(() => { valueRef.current = value; }, [value]);

  const speechOk = Boolean(SpeechRecognitionAPI);

  const startRecording = () => {
    if (!SpeechRecognitionAPI) return;
    try {
      const rec = new SpeechRecognitionAPI();
      rec.lang = 'pt-BR';
      rec.continuous = true;
      rec.interimResults = true;
      rec.onresult = (e: SpeechRecognitionEvent) => {
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const result = e.results[i];
          if (!result.isFinal) continue;
          const transcript = result[0].transcript.trim();
          if (!transcript) continue;
          const prev = valueRef.current;
          const next = prev ? `${prev} ${transcript}` : transcript;
          valueRef.current = next;
          onChange(next);
        }
      };
      rec.onerror = () => setRecording(false);
      rec.onend = () => setRecording(false);
      recognitionRef.current = rec;
      rec.start();
      setRecording(true);
    } catch {
      /* noop */
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch { /* noop */ }
      recognitionRef.current = null;
    }
    setRecording(false);
  };

  return (
    <div className="space-y-1.5">
      <label className="text-xs text-muted-foreground font-medium">O que foi feito</label>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Digite ou use o microfone para descrever o que foi feito no local..."
        rows={3}
        className="resize-none text-sm rounded-xl border-border"
      />
      {speechOk && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn(
            'w-full gap-2 rounded-xl border-border',
            isRecording && 'border-destructive bg-destructive/10 text-destructive'
          )}
          onClick={isRecording ? stopRecording : startRecording}
        >
          {isRecording
            ? <><Square className="h-4 w-4" /> Parar gravação</>
            : <><Mic className="h-4 w-4" /> Gravar com microfone</>}
        </Button>
      )}
    </div>
  );
}

export function ItemPlanoAcao({
  itemId,
  statusLocal,
  acaoAplicadaLocal,
  checkinEm,
  isSaving,
  onAcaoChange,
  onCheckinRegistered,
  onSave,
  onIniciarAtendimento,
  onConfirmarResolucao,
  onCancelarAtendimento,
}: ItemPlanoAcaoProps) {

  // ── PENDENTE ──────────────────────────────────────────────────────────────
  if (statusLocal === 'pendente') {
    return (
      <Card className="rounded-2xl border-2 border-border bg-card shadow-none overflow-hidden">
        <CardContent className="px-3 py-2.5 sm:px-4 sm:py-3 space-y-3">
          <h4 className="text-xs font-semibold text-primary uppercase tracking-wider">
            Status do atendimento
          </h4>
          <div className="flex items-center gap-2.5 rounded-xl bg-muted/40 border border-border px-3 py-2.5">
            <Circle className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="text-sm text-muted-foreground">Aguardando início do atendimento</span>
          </div>
          <Button
            type="button"
            className="w-full rounded-xl gap-2"
            onClick={onIniciarAtendimento}
            disabled={isSaving}
          >
            {isSaving
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <LocateFixed className="w-4 h-4" />}
            {isSaving ? 'Iniciando...' : 'Iniciar atendimento'}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // ── EM ATENDIMENTO ────────────────────────────────────────────────────────
  if (statusLocal === 'em_atendimento') {
    return (
      <Card className="rounded-2xl border-2 border-border bg-card shadow-none overflow-hidden">
        <CardContent className="px-3 py-2.5 sm:px-4 sm:py-3 space-y-3">
          <h4 className="text-xs font-semibold text-primary uppercase tracking-wider">
            Em atendimento
          </h4>

          <ItemCheckinButton
            itemId={itemId}
            checkinEm={checkinEm}
            onCheckinRegistered={onCheckinRegistered}
          />

          <OQueFoiFeito value={acaoAplicadaLocal} onChange={onAcaoChange} />

          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="flex-1 rounded-xl gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={onCancelarAtendimento}
              disabled={isSaving}
            >
              <X className="w-3.5 h-3.5" />
              Cancelar atendimento
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex-1 rounded-xl gap-1.5 border-border"
              onClick={onSave}
              disabled={isSaving}
            >
              {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Salvar progresso
            </Button>
          </div>

          <Button
            type="button"
            size="sm"
            className="w-full rounded-xl gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={onConfirmarResolucao}
            disabled={isSaving}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Marcar como resolvido
          </Button>
        </CardContent>
      </Card>
    );
  }

  // ── RESOLVIDO ─────────────────────────────────────────────────────────────
  return (
    <Card className="rounded-2xl border-2 border-emerald-200 dark:border-emerald-800 bg-emerald-50/30 dark:bg-emerald-950/20 shadow-none overflow-hidden">
      <CardContent className="px-3 py-2.5 sm:px-4 sm:py-3 space-y-3">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <h4 className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
            Item resolvido
          </h4>
        </div>
        <div className="space-y-1">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            O que foi feito
          </p>
          {acaoAplicadaLocal ? (
            <p className="text-sm text-foreground leading-relaxed rounded-xl bg-muted/40 px-3 py-2.5">
              {acaoAplicadaLocal}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground italic px-3 py-2.5">
              Nenhuma descrição registrada
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
