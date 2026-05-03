import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, LocateFixed, Users, Baby, HeartHandshake, PersonStanding, Mic, CheckCheck, DoorClosed, ShieldAlert, House } from 'lucide-react';
import { useVoiceInput, parseNumeroVoz } from '@/hooks/useVoiceInput';
import { cn } from '@/lib/utils';

export interface Etapa1Data {
  moradores_qtd: number;
  gravidas: number;
  idosos: number;
  criancas_7anos: number;
  lat_chegada: number | null;
  lng_chegada: number | null;
  checkin_em: string | null;
}

type StatusAcesso = 'tratado' | 'fechado' | 'recusa' | 'desocupado' | null;

interface Props {
  data: Etapa1Data;
  onChange: (data: Etapa1Data) => void;
  onNext: () => void;
  onSemAcesso?: () => void;
}

const STATUS_OPTIONS: {
  key: Exclude<StatusAcesso, null>;
  label: string;
  sublabel: string;
  icon: React.ReactNode;
  border: string;
  bg: string;
  text: string;
  selectedBorder: string;
  selectedBg: string;
  selectedText: string;
}[] = [
  {
    key: 'tratado',
    label: 'Tratado',
    sublabel: 'Acesso realizado',
    icon: <CheckCheck className="w-6 h-6" />,
    border: 'border-emerald-200 dark:border-emerald-800',
    bg: 'bg-card',
    text: 'text-foreground',
    selectedBorder: 'border-emerald-500',
    selectedBg: 'bg-emerald-50 dark:bg-emerald-950/40',
    selectedText: 'text-emerald-700 dark:text-emerald-400',
  },
  {
    key: 'fechado',
    label: 'Fechado',
    sublabel: 'Ausente / viagem',
    icon: <DoorClosed className="w-6 h-6" />,
    border: 'border-amber-200 dark:border-amber-800',
    bg: 'bg-card',
    text: 'text-foreground',
    selectedBorder: 'border-amber-500',
    selectedBg: 'bg-amber-50 dark:bg-amber-950/40',
    selectedText: 'text-amber-700 dark:text-amber-400',
  },
  {
    key: 'recusa',
    label: 'Recusa',
    sublabel: 'Não permitiu entrada',
    icon: <ShieldAlert className="w-6 h-6" />,
    border: 'border-rose-200 dark:border-rose-800',
    bg: 'bg-card',
    text: 'text-foreground',
    selectedBorder: 'border-rose-500',
    selectedBg: 'bg-rose-50 dark:bg-rose-950/40',
    selectedText: 'text-rose-700 dark:text-rose-400',
  },
  {
    key: 'desocupado',
    label: 'Desocupado',
    sublabel: 'Imóvel vazio',
    icon: <House className="w-6 h-6" />,
    border: 'border-slate-200 dark:border-slate-700',
    bg: 'bg-card',
    text: 'text-foreground',
    selectedBorder: 'border-slate-400',
    selectedBg: 'bg-slate-50 dark:bg-slate-800/40',
    selectedText: 'text-slate-600 dark:text-slate-400',
  },
];

function GroupCounter({ label, icon, value, onChange }: { label: string; icon: React.ReactNode; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center justify-between py-1">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground shrink-0">{icon}</span>
        <span className="text-sm font-semibold text-foreground">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(Math.max(0, value - 1))}
          className="w-8 h-8 rounded-xl border-2 border-border flex items-center justify-center text-lg font-bold hover:bg-muted transition-colors"
        >
          −
        </button>
        <span className="text-xl font-black w-8 text-center tabular-nums">{value}</span>
        <button
          type="button"
          onClick={() => onChange(value + 1)}
          className="w-8 h-8 rounded-xl border-2 border-border flex items-center justify-center text-lg font-bold hover:bg-muted transition-colors"
        >
          +
        </button>
      </div>
    </div>
  );
}

export function VistoriaEtapa1Responsavel({ data, onChange, onNext, onSemAcesso }: Props) {
  const [statusAcesso, setStatusAcesso] = useState<StatusAcesso>(null);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [gpsError, setGpsError] = useState(false);

  // GPS automático quando "Tratado" é selecionado
  useEffect(() => {
    if (statusAcesso !== 'tratado' || data.checkin_em || !navigator.geolocation) return;
    setGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onChange({
          ...data,
          lat_chegada: pos.coords.latitude,
          lng_chegada: pos.coords.longitude,
          checkin_em: new Date().toISOString(),
        });
        setGettingLocation(false);
      },
      () => { setGpsError(true); setGettingLocation(false); },
      { timeout: 8000, maximumAge: 30000, enableHighAccuracy: false },
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusAcesso]);

  function handleSelectStatus(key: Exclude<StatusAcesso, null>) {
    setStatusAcesso(key);
    if (key !== 'tratado' && onSemAcesso) {
      const confirmado = window.confirm(
        'Você está registrando uma tentativa SEM ACESSO ao imóvel.\n\nIsso contará como tentativa no histórico e pode ativar prioridade de drone após 3 tentativas.\n\nConfirma?'
      );
      if (!confirmado) {
        setStatusAcesso(null);
        return;
      }
      onSemAcesso();
    }
  }

  const setMoradores = (delta: number) =>
    onChange({ ...data, moradores_qtd: Math.max(0, data.moradores_qtd + delta) });

  const voiceMoradores = useVoiceInput((transcript) => {
    const n = parseNumeroVoz(transcript);
    if (n !== null) onChange({ ...data, moradores_qtd: Math.max(0, n) });
  });

  return (
    <div className="space-y-4">
      {/* 4 status buttons */}
      <Card className="rounded-2xl border-border">
        <CardContent className="p-4 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Situação do imóvel
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            {STATUS_OPTIONS.map((opt) => {
              const selected = statusAcesso === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => handleSelectStatus(opt.key)}
                  className={cn(
                    'flex flex-col items-center justify-center gap-2 py-4 px-3 rounded-2xl border-2 transition-all active:scale-95',
                    selected
                      ? `${opt.selectedBorder} ${opt.selectedBg} ${opt.selectedText}`
                      : `${opt.border} ${opt.bg} ${opt.text} hover:bg-muted/40`
                  )}
                >
                  <span className={selected ? opt.selectedText : 'text-muted-foreground'}>
                    {opt.icon}
                  </span>
                  <div className="text-center">
                    <p className="text-sm font-bold leading-tight">{opt.label}</p>
                    <p className="text-[10px] opacity-70 leading-tight mt-0.5">{opt.sublabel}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Conteúdo visível apenas quando tratado */}
      {statusAcesso === 'tratado' && (
        <>
          {/* GPS checkin status */}
          <Card className="rounded-2xl border-border">
            <CardContent className="p-4 flex items-center gap-3">
              {gettingLocation ? (
                <Loader2 className="w-5 h-5 text-primary animate-spin shrink-0" />
              ) : (
                <LocateFixed className={cn('w-5 h-5 shrink-0', data.checkin_em ? 'text-emerald-500' : 'text-muted-foreground')} />
              )}
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {gettingLocation
                    ? 'Obtendo localização... você já pode avançar'
                    : data.checkin_em
                    ? 'Chegada registrada com GPS'
                    : gpsError
                    ? 'GPS indisponível — você pode continuar sem localização'
                    : 'GPS não obtido'}
                </p>
                {gettingLocation && (
                  <p className="text-[11px] text-muted-foreground">A localização será registrada quando disponível.</p>
                )}
                {gpsError && !data.checkin_em && (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400">A vistoria será salva sem coordenadas GPS.</p>
                )}
                {data.lat_chegada != null && (
                  <p className="text-[11px] text-muted-foreground font-mono">
                    {data.lat_chegada.toFixed(5)}, {data.lng_chegada?.toFixed(5)}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Número de moradores */}
          <Card className="rounded-2xl border-border">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <Users className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold text-primary uppercase tracking-wider">Moradores</h3>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-foreground">Número de moradores</span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setMoradores(-1)}
                    className="w-9 h-9 rounded-xl border-2 border-border flex items-center justify-center text-lg font-bold hover:bg-muted transition-colors"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={data.moradores_qtd}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      if (!isNaN(v) && v >= 0) onChange({ ...data, moradores_qtd: v });
                    }}
                    className="text-2xl font-black w-14 text-center tabular-nums bg-transparent border-b-2 border-border focus:border-primary outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setMoradores(1)}
                    className="w-9 h-9 rounded-xl border-2 border-border flex items-center justify-center text-lg font-bold hover:bg-muted transition-colors"
                  >
                    +
                  </button>
                  {voiceMoradores.isSupported && (
                    <button
                      type="button"
                      onPointerDown={voiceMoradores.start}
                      onPointerUp={voiceMoradores.stop}
                      className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${voiceMoradores.isRecording ? 'text-red-500 animate-pulse' : 'text-muted-foreground hover:text-foreground'}`}
                      aria-label="Ditar número de moradores"
                    >
                      <Mic className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Contadores de grupos vulneráveis */}
          <Card className="rounded-2xl border-border">
            <CardContent className="p-4 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Grupos vulneráveis</p>
              <GroupCounter
                label="Grávidas"
                icon={<HeartHandshake className="w-5 h-5" />}
                value={data.gravidas}
                onChange={(v) => onChange({ ...data, gravidas: v })}
              />
              <GroupCounter
                label="Idosos"
                icon={<PersonStanding className="w-5 h-5" />}
                value={data.idosos}
                onChange={(v) => onChange({ ...data, idosos: v })}
              />
              <GroupCounter
                label="Crianças < 7 anos"
                icon={<Baby className="w-5 h-5" />}
                value={data.criancas_7anos}
                onChange={(v) => onChange({ ...data, criancas_7anos: v })}
              />
            </CardContent>
          </Card>

          <Button className="w-full h-12 rounded-xl text-base font-bold" onClick={onNext}>
            Avançar
          </Button>
        </>
      )}
    </div>
  );
}
