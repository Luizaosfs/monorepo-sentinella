import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ShieldAlert, Loader2, Mic, Square } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

export interface Etapa5Data {
  // Risco Social
  menor_incapaz: boolean;
  idoso_incapaz: boolean;
  dep_quimico: boolean;
  risco_alimentar: boolean;
  risco_moradia: boolean;
  // Risco Sanitário
  criadouro_animais: boolean;
  lixo: boolean;
  residuos_organicos: boolean;
  residuos_quimicos: boolean;
  residuos_medicos: boolean;
  // Risco Vetorial
  acumulo_material_organico: boolean;
  animais_sinais_lv: boolean;
  caixa_destampada: boolean;
  outro_risco_vetorial: string;
  observacao: string;
}

export const ETAPA5_DEFAULT: Etapa5Data = {
  menor_incapaz: false,
  idoso_incapaz: false,
  dep_quimico: false,
  risco_alimentar: false,
  risco_moradia: false,
  criadouro_animais: false,
  lixo: false,
  residuos_organicos: false,
  residuos_quimicos: false,
  residuos_medicos: false,
  acumulo_material_organico: false,
  animais_sinais_lv: false,
  caixa_destampada: false,
  outro_risco_vetorial: '',
  observacao: '',
};

type BooleanKey = keyof Omit<Etapa5Data, 'outro_risco_vetorial' | 'observacao'>;

interface RiscoItem {
  key: BooleanKey;
  label: string;
}

const RISCOS_SOCIAIS: RiscoItem[] = [
  { key: 'menor_incapaz', label: 'Menor incapaz presente' },
  { key: 'idoso_incapaz', label: 'Idoso incapaz presente' },
  { key: 'dep_quimico', label: 'Dependente químico' },
  { key: 'risco_alimentar', label: 'Risco alimentar' },
  { key: 'risco_moradia', label: 'Risco de moradia' },
];

const RISCOS_SANITARIOS: RiscoItem[] = [
  { key: 'criadouro_animais', label: 'Criadouro de animais' },
  { key: 'lixo', label: 'Acúmulo de lixo' },
  { key: 'residuos_organicos', label: 'Resíduos orgânicos' },
  { key: 'residuos_quimicos', label: 'Resíduos químicos' },
  { key: 'residuos_medicos', label: 'Resíduos médicos' },
];

const RISCOS_VETORIAIS: RiscoItem[] = [
  { key: 'acumulo_material_organico', label: 'Acúmulo de material orgânico' },
  { key: 'animais_sinais_lv', label: 'Animais com sinais de LV' },
  { key: 'caixa_destampada', label: "Caixa d'água destampada" },
];

const SpeechRecognitionAPI =
  typeof window !== 'undefined'
    ? ((window as Window & {
        SpeechRecognition?: new () => SpeechRecognition;
        webkitSpeechRecognition?: new () => SpeechRecognition;
      }).SpeechRecognition ||
      (window as Window & { webkitSpeechRecognition?: new () => SpeechRecognition }).webkitSpeechRecognition)
    : undefined;

interface Props {
  data: Etapa5Data;
  onChange: (data: Etapa5Data) => void;
  onPreFinalize: () => void;
  isSaving?: boolean;
  isBlocked?: boolean;
}

function RiscoToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        'flex items-center gap-3 w-full p-3 rounded-xl border-2 transition-all text-left',
        checked
          ? 'border-amber-500 bg-amber-50/60 dark:bg-amber-950/20 text-amber-700 dark:text-amber-300'
          : 'border-border bg-card text-foreground hover:border-muted-foreground/40',
      )}
    >
      <span className="text-sm font-semibold flex-1">{label}</span>
      <span
        className={cn(
          'w-10 h-6 rounded-full border-2 transition-colors flex items-center px-0.5 shrink-0',
          checked ? 'bg-amber-500 border-amber-500 justify-end' : 'bg-muted border-border justify-start',
        )}
      >
        <span className="w-4 h-4 rounded-full bg-white shadow" />
      </span>
    </button>
  );
}

function RiscoGroup({
  title,
  subtitle,
  items,
  data,
  onChange,
}: {
  title: string;
  subtitle?: string;
  items: RiscoItem[];
  data: Etapa5Data;
  onChange: (data: Etapa5Data) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="px-1">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{title}</p>
        {subtitle && <p className="text-[10px] text-muted-foreground/70 mt-0.5">{subtitle}</p>}
      </div>
      {items.map(({ key, label }) => (
        <RiscoToggle
          key={key}
          label={label}
          checked={data[key] as boolean}
          onChange={(v) => onChange({ ...data, [key]: v })}
        />
      ))}
    </div>
  );
}

export function VistoriaEtapa5Riscos({ data, onChange, onPreFinalize, isSaving, isBlocked }: Props) {
  const [recordingField, setRecordingField] = useState<'outro_risco_vetorial' | 'observacao' | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const dataRef = useRef(data);
  const speechOk = Boolean(SpeechRecognitionAPI);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const stopRecording = () => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch { /* noop */ }
      recognitionRef.current = null;
    }
    setRecordingField(null);
  };

  const startRecording = (field: 'outro_risco_vetorial' | 'observacao') => {
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
          const current = dataRef.current;
          onChange({
            ...current,
            [field]: current[field]
              ? `${current[field]} ${transcript}`.trim()
              : transcript,
          });
        }
      };
      rec.onerror = () => {
        setRecordingField(null);
      };
      rec.onend = () => {
        setRecordingField(null);
      };
      recognitionRef.current = rec;
      setRecordingField(field);
      rec.start();
    } catch {
      toast.error('Microfone não disponível no dispositivo.');
      setRecordingField(null);
    }
  };

  const totalRiscos =
    [...RISCOS_SOCIAIS, ...RISCOS_SANITARIOS, ...RISCOS_VETORIAIS].filter(({ key }) => data[key]).length +
    (data.outro_risco_vetorial.trim() ? 1 : 0);

  return (
    <div className="space-y-4">
      <Card className="rounded-2xl border-border">
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <ShieldAlert className="w-4 h-4 text-primary" />
            <p className="text-xs font-semibold text-primary uppercase tracking-wider">Fatores de risco</p>
          </div>

          <RiscoGroup title="Riscos sociais" subtitle="Situações de vulnerabilidade dos moradores" items={RISCOS_SOCIAIS} data={data} onChange={onChange} />
          <RiscoGroup title="Riscos sanitários" subtitle="Condições inadequadas de limpeza ou descarte" items={RISCOS_SANITARIOS} data={data} onChange={onChange} />
          <RiscoGroup title="Riscos vetoriais" subtitle="Possíveis criadouros do mosquito Aedes aegypti" items={RISCOS_VETORIAIS} data={data} onChange={onChange} />

          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-1">
              Outro risco vetorial
            </p>
            <textarea
              rows={2}
              placeholder="Descreva se houver outro risco vetorial…"
              value={data.outro_risco_vetorial}
              onChange={(e) => onChange({ ...data, outro_risco_vetorial: e.target.value })}
              className="w-full rounded-xl border-2 border-border bg-card px-3 py-2.5 text-sm placeholder:text-muted-foreground resize-none focus:outline-none focus:border-primary transition-colors"
            />
            {speechOk && (
              <div className="space-y-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={cn(
                    'gap-2 rounded-xl border-border',
                    recordingField === 'outro_risco_vetorial' && 'border-destructive bg-destructive/10 text-destructive'
                  )}
                  onClick={() =>
                    recordingField === 'outro_risco_vetorial'
                      ? stopRecording()
                      : startRecording('outro_risco_vetorial')
                  }
                >
                  {recordingField === 'outro_risco_vetorial' ? (
                    <>
                      <Square className="h-4 w-4" />
                      Parar gravação
                    </>
                  ) : (
                    <>
                      <Mic className="h-4 w-4" />
                      Gravar por voz
                    </>
                  )}
                </Button>
                <p className="text-[11px] text-muted-foreground px-1">
                  Dica: funciona melhor no Chrome (Android/Desktop).
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border">
        <CardContent className="p-4 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Observações gerais</p>
          <textarea
            rows={3}
            placeholder="Qualquer observação relevante sobre a vistoria…"
            value={data.observacao}
            onChange={(e) => onChange({ ...data, observacao: e.target.value })}
            className="w-full rounded-xl border-2 border-border bg-card px-3 py-2.5 text-sm placeholder:text-muted-foreground resize-none focus:outline-none focus:border-primary transition-colors"
          />
          {speechOk && (
            <div className="space-y-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={cn(
                  'gap-2 rounded-xl border-border',
                  recordingField === 'observacao' && 'border-destructive bg-destructive/10 text-destructive'
                )}
                onClick={() =>
                  recordingField === 'observacao'
                    ? stopRecording()
                    : startRecording('observacao')
                }
              >
                {recordingField === 'observacao' ? (
                  <>
                    <Square className="h-4 w-4" />
                    Parar gravação
                  </>
                ) : (
                  <>
                    <Mic className="h-4 w-4" />
                    Gravar por voz
                  </>
                )}
              </Button>
              <p className="text-[11px] text-muted-foreground px-1">
                Dica: funciona melhor no Chrome (Android/Desktop).
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {totalRiscos > 0 && (
        <div className="flex items-start gap-3 p-4 rounded-2xl border-2 border-amber-400/50 bg-amber-50/60 dark:bg-amber-950/20">
          <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-700 dark:text-amber-400 font-semibold">
            {totalRiscos} fator{totalRiscos !== 1 ? 'es' : ''} de risco registrado{totalRiscos !== 1 ? 's' : ''}.
          </p>
        </div>
      )}

      <Button
        className="w-full h-12 rounded-xl text-base font-bold"
        onClick={onPreFinalize}
        disabled={isSaving || isBlocked}
      >
        {isSaving ? (
          <span className="flex items-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            Salvando…
          </span>
        ) : (
          'Finalizar vistoria'
        )}
      </Button>
    </div>
  );
}
