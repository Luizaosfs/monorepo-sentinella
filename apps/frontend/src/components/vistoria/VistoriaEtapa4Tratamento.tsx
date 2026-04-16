import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { FlaskConical, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TipoDeposito, DEPOSITO_LABELS } from '@/types/database';
import type { TipoAtividade } from '@/types/database';
import type { DepositoRow } from './VistoriaEtapa3Inspecao';

export interface TratamentoRow {
  tipo: TipoDeposito;
  qtd_eliminados: number;
  usou_larvicida: boolean;
  qtd_larvicida_g: number;
}

export interface Etapa4Data {
  tratamentos: TratamentoRow[];
}

interface Props {
  depositos: DepositoRow[];   // read-only, from etapa 3
  data: Etapa4Data;
  onChange: (data: Etapa4Data) => void;
  onNext: () => void;
  atividade?: TipoAtividade;
}

function Counter({
  value,
  max,
  onChange,
}: {
  value: number;
  max?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onChange(Math.max(0, value - 1))}
        className="w-8 h-8 rounded-lg border-2 border-border flex items-center justify-center font-bold hover:bg-muted transition-colors text-base"
      >
        −
      </button>
      <span className="w-7 text-center font-black text-lg tabular-nums text-foreground">
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(max != null ? Math.min(value + 1, max) : value + 1)}
        className="w-8 h-8 rounded-lg border-2 border-border flex items-center justify-center font-bold hover:bg-muted transition-colors text-base"
      >
        +
      </button>
    </div>
  );
}

export function createEtapa4Default(depositos: DepositoRow[], atividade?: TipoAtividade): Etapa4Data {
  const candidatos = atividade === 'pesquisa'
    ? depositos.filter((d) => d.qtd_inspecionados > 0)
    : depositos.filter((d) => d.qtd_com_focos > 0);
  return {
    tratamentos: candidatos.map((d) => ({
      tipo: d.tipo,
      qtd_eliminados: 0,
      usou_larvicida: false,
      qtd_larvicida_g: 0,
    })),
  };
}

export function VistoriaEtapa4Tratamento({ depositos, data, onChange, onNext, atividade }: Props) {
  const isPesquisa = atividade === 'pesquisa';
  const candidatos = isPesquisa
    ? depositos.filter((d) => d.qtd_inspecionados > 0)
    : depositos.filter((d) => d.qtd_com_focos > 0);

  function updateTratamento(tipo: TipoDeposito, patch: Partial<TratamentoRow>) {
    onChange({
      tratamentos: data.tratamentos.map((t) =>
        t.tipo === tipo ? { ...t, ...patch } : t,
      ),
    });
  }

  return (
    <div className="space-y-4">
      <Card className="rounded-2xl border-border">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <Trash2 className="w-4 h-4 text-primary" />
            <p className="text-xs font-semibold text-primary uppercase tracking-wider">
              {isPesquisa ? 'Larvicida por depósito' : 'Eliminação de focos'}
            </p>
          </div>

          {candidatos.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">
              {isPesquisa
                ? 'Nenhum depósito inspecionado registrado na etapa anterior.'
                : 'Nenhum depósito com foco registrado na etapa anterior.'}
            </p>
          ) : (
            candidatos.map((dep) => {
              const trat = data.tratamentos.find((t) => t.tipo === dep.tipo) ?? {
                tipo: dep.tipo,
                qtd_eliminados: 0,
                usou_larvicida: false,
                qtd_larvicida_g: 0,
              };
              return (
                <div
                  key={dep.tipo}
                  className="rounded-xl border border-border bg-card p-3 space-y-3"
                >
                  <div>
                    <span className="text-sm font-bold">{dep.tipo}</span>
                    <span className="text-xs text-muted-foreground ml-2">
                      {DEPOSITO_LABELS[dep.tipo]}
                    </span>
                    <span className="ml-2 text-xs text-muted-foreground font-semibold">
                      ({isPesquisa ? dep.qtd_inspecionados : dep.qtd_com_focos}{' '}
                      {isPesquisa ? 'inspecionado(s)' : 'com foco'})
                    </span>
                  </div>

                  {!isPesquisa && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Eliminados</span>
                      <Counter
                        value={trat.qtd_eliminados}
                        max={dep.qtd_com_focos}
                        onChange={(v) => updateTratamento(dep.tipo, { qtd_eliminados: v })}
                      />
                    </div>
                  )}

                  {/* Larvicida toggle */}
                  <button
                    type="button"
                    onClick={() =>
                      updateTratamento(dep.tipo, {
                        usou_larvicida: !trat.usou_larvicida,
                        qtd_larvicida_g: trat.usou_larvicida ? 0 : trat.qtd_larvicida_g,
                      })
                    }
                    className={cn(
                      'flex items-center gap-3 w-full p-3 rounded-xl border-2 transition-all text-left',
                      trat.usou_larvicida
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-border bg-card text-foreground hover:border-muted-foreground/40',
                    )}
                  >
                    <FlaskConical className={cn('w-4 h-4 shrink-0', trat.usou_larvicida ? 'text-primary' : 'text-muted-foreground')} />
                    <span className="text-sm font-semibold flex-1">Aplicou produto biológico (larvicida)</span>
                    <span
                      className={cn(
                        'w-10 h-6 rounded-full border-2 transition-colors flex items-center px-0.5 shrink-0',
                        trat.usou_larvicida
                          ? 'bg-primary border-primary justify-end'
                          : 'bg-muted border-border justify-start',
                      )}
                    >
                      <span className="w-4 h-4 rounded-full bg-white shadow" />
                    </span>
                  </button>

                  {trat.usou_larvicida && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Quantidade aplicada (gramas)</span>
                      <Counter
                        value={trat.qtd_larvicida_g}
                        onChange={(v) => updateTratamento(dep.tipo, { qtd_larvicida_g: v })}
                      />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <Button className="w-full h-12 rounded-xl text-base font-bold" onClick={onNext}>
        Avançar
      </Button>
    </div>
  );
}
