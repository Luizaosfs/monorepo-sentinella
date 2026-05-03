import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AlertTriangle, Thermometer, Dot } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Etapa2Data {
  febre: boolean;
  manchas_vermelhas: boolean;
  dor_articulacoes: boolean;
  dor_cabeca: boolean;
  nausea: boolean;
  moradores_sintomas_qtd: number;
}

interface Props {
  data: Etapa2Data;
  onChange: (data: Etapa2Data) => void;
  onNext: () => void;
}

const SINTOMAS: { key: keyof Omit<Etapa2Data, 'moradores_sintomas_qtd'>; label: string }[] = [
  { key: 'febre', label: 'Febre' },
  { key: 'manchas_vermelhas', label: 'Manchas vermelhas' },
  { key: 'dor_articulacoes', label: 'Dor nas articulações' },
  { key: 'dor_cabeca', label: 'Dor de cabeça' },
  { key: 'nausea', label: 'Náusea' },
];

export function VistoriaEtapa2Sintomas({ data, onChange, onNext }: Props) {
  const algumSintoma = SINTOMAS.some((s) => data[s.key]);

  return (
    <div className="space-y-4">
      <Card className="rounded-2xl border-border">
        <CardContent className="p-4 space-y-2.5">
          <div className="flex items-center gap-2 mb-1">
            <Thermometer className="w-4 h-4 text-primary" />
            <p className="text-xs font-semibold text-primary uppercase tracking-wider">Sintomas nos moradores</p>
          </div>
          {SINTOMAS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => onChange({ ...data, [key]: !data[key] })}
              className={cn(
                'flex items-center gap-3 w-full p-3.5 rounded-xl border-2 transition-all text-left',
                data[key]
                  ? 'border-rose-500 bg-rose-50/60 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400'
                  : 'border-border bg-card text-foreground hover:border-muted-foreground/40'
              )}
            >
              <Dot className={cn('w-5 h-5 shrink-0', data[key] ? 'text-rose-500' : 'text-muted-foreground')} />
              <span className="text-sm font-semibold flex-1">{label}</span>
              <span className={cn(
                'w-10 h-6 rounded-full border-2 transition-colors flex items-center px-0.5 shrink-0',
                data[key] ? 'bg-rose-500 border-rose-500 justify-end' : 'bg-muted border-border justify-start'
              )}>
                <span className="w-4 h-4 rounded-full bg-white shadow" />
              </span>
            </button>
          ))}
        </CardContent>
      </Card>

      {/* Contagem de moradores com sintomas — só aparece se algum toggle ativo */}
      {algumSintoma && (
        <Card className="rounded-2xl border-border">
          <CardContent className="p-4 space-y-3">
            <p className="text-sm font-semibold text-foreground">Quantos moradores com sintomas?</p>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Moradores afetados</span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => onChange({ ...data, moradores_sintomas_qtd: Math.max(0, data.moradores_sintomas_qtd - 1) })}
                  className="w-9 h-9 rounded-xl border-2 border-border flex items-center justify-center text-lg font-bold hover:bg-muted"
                >
                  −
                </button>
                <span className="text-2xl font-black w-8 text-center tabular-nums">{data.moradores_sintomas_qtd}</span>
                <button
                  type="button"
                  onClick={() => onChange({ ...data, moradores_sintomas_qtd: data.moradores_sintomas_qtd + 1 })}
                  className="w-9 h-9 rounded-xl border-2 border-border flex items-center justify-center text-lg font-bold hover:bg-muted"
                >
                  +
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Banner: caso suspeito será gerado */}
      {algumSintoma && data.moradores_sintomas_qtd > 0 && (
        <div className="flex items-start gap-3 p-4 rounded-2xl border-2 border-amber-400/50 bg-amber-50/60 dark:bg-amber-950/20">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-700 dark:text-amber-400 font-semibold">
            Um alerta de caso suspeito será gerado automaticamente ao finalizar a vistoria.
          </p>
        </div>
      )}

      <Button className="w-full h-12 rounded-xl text-base font-bold" onClick={onNext}>
        Avançar
      </Button>
    </div>
  );
}
