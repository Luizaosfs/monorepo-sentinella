import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Layers, AlertCircle, Wrench, Mic, ChevronDown, ChevronRight, Droplets, Bug, Trash2, Shield } from 'lucide-react';
import { IdentificacaoLarvaIA, type LarvaIAResult } from './IdentificacaoLarvaIA';
import { useVoiceInput, parseNumeroVoz } from '@/hooks/useVoiceInput';
import { cn } from '@/lib/utils';
import {
  TipoDeposito, DEPOSITO_LABELS,
  PosicaoCalha, CondicaoCalha,
  POSICAO_CALHA_LABELS, CONDICAO_CALHA_LABELS,
} from '@/types/database';

export interface DepositoRow {
  tipo: TipoDeposito;
  qtd_inspecionados: number;
  qtd_com_agua: number;
  qtd_com_focos: number;
  eliminado: boolean;
  vedado: boolean;
  ia_identificacao?: LarvaIAResult | null;
}

export interface CalhaRow {
  posicao: PosicaoCalha;
  condicao: CondicaoCalha;
  com_foco: boolean;
  acessivel: boolean;
  tratamento_realizado: boolean;
  foto_url: string | null;
}

export interface Etapa3Data {
  depositos: DepositoRow[];
  tem_calha: boolean;
  calha_inacessivel: boolean;
  calhas: CalhaRow[];
}

const TIPOS_DEPOSITO: TipoDeposito[] = ['A1', 'A2', 'B', 'C', 'D1', 'D2', 'E'];

function initDepositos(): DepositoRow[] {
  return TIPOS_DEPOSITO.map((tipo) => ({
    tipo,
    qtd_inspecionados: 0,
    qtd_com_agua: 0,
    qtd_com_focos: 0,
    eliminado: false,
    vedado: false,
    ia_identificacao: null,
  }));
}

export function createEtapa3Default(): Etapa3Data {
  return { depositos: initDepositos(), tem_calha: false, calha_inacessivel: false, calhas: [] };
}

interface Props {
  data: Etapa3Data;
  onChange: (data: Etapa3Data) => void;
  onNext: () => void;
  vistoriaId?: string;
}

function Counter({
  value,
  onChange,
  danger,
  warning,
}: {
  value: number;
  onChange: (v: number) => void;
  danger?: boolean;
  warning?: boolean;
}) {
  const voice = useVoiceInput((transcript) => {
    const n = parseNumeroVoz(transcript);
    if (n !== null) onChange(Math.max(0, n));
  });

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => onChange(Math.max(0, value - 1))}
        className="w-11 h-11 rounded-lg border-2 border-border flex items-center justify-center font-bold hover:bg-muted transition-colors text-base"
      >
        −
      </button>
      <span
        className={cn(
          'w-7 text-center font-black text-lg tabular-nums',
          danger && value > 0
            ? 'text-rose-600'
            : warning && value > 0
            ? 'text-amber-600'
            : 'text-foreground',
        )}
      >
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        className="w-11 h-11 rounded-lg border-2 border-border flex items-center justify-center font-bold hover:bg-muted transition-colors text-base"
      >
        +
      </button>
      {voice.isSupported && (
        <button
          type="button"
          onPointerDown={voice.start}
          onPointerUp={voice.stop}
          className={`w-6 h-6 flex items-center justify-center rounded transition-colors ${voice.isRecording ? 'text-red-500 animate-pulse' : 'text-muted-foreground hover:text-foreground'}`}
          aria-label="Ditar valor"
        >
          <Mic className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

function SmallToggle({
  label,
  icon,
  checked,
  onChange,
  colorClass,
}: {
  label: string;
  icon: React.ReactNode;
  checked: boolean;
  onChange: (v: boolean) => void;
  colorClass: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        'flex items-center gap-2 flex-1 px-3 py-2 rounded-xl border-2 transition-all text-sm font-semibold',
        checked ? colorClass : 'border-border text-muted-foreground hover:border-muted-foreground/40'
      )}
    >
      <span className="shrink-0">{icon}</span>
      <span className="text-xs font-bold">{label}</span>
      <span className={cn('ml-auto w-8 h-5 rounded-full border-2 transition-colors flex items-center px-0.5 shrink-0', checked ? 'bg-current border-current justify-end opacity-100' : 'bg-muted border-border justify-start')}>
        <span className="w-3 h-3 rounded-full bg-white shadow" />
      </span>
    </button>
  );
}

function DepositoAccordion({
  dep,
  vistoriaId,
  onUpdate,
}: {
  dep: DepositoRow;
  vistoriaId?: string;
  onUpdate: (updated: DepositoRow) => void;
}) {
  const hasActivity = dep.qtd_inspecionados > 0 || dep.qtd_com_agua > 0 || dep.qtd_com_focos > 0;
  const [open, setOpen] = useState(false);

  function clampedUpdate(field: keyof DepositoRow, value: number | boolean) {
    const next = { ...dep, [field]: value };
    // com_agua ≤ inspecionados
    if (field === 'qtd_inspecionados') {
      next.qtd_com_agua = Math.min(next.qtd_com_agua, value as number);
      next.qtd_com_focos = Math.min(next.qtd_com_focos, next.qtd_com_agua);
    }
    // com_focos ≤ com_agua ≤ inspecionados
    if (field === 'qtd_com_agua') {
      next.qtd_com_agua = Math.min(value as number, next.qtd_inspecionados);
      next.qtd_com_focos = Math.min(next.qtd_com_focos, next.qtd_com_agua);
    }
    if (field === 'qtd_com_focos') {
      next.qtd_com_focos = Math.min(value as number, next.qtd_com_agua);
    }
    onUpdate(next);
  }

  return (
    <div
      className={cn(
        'rounded-xl border-2 transition-colors overflow-hidden',
        dep.qtd_com_focos > 0
          ? 'border-rose-300 bg-rose-50/30 dark:bg-rose-950/10'
          : dep.qtd_com_agua > 0
          ? 'border-amber-300 bg-amber-50/20 dark:bg-amber-950/10'
          : dep.qtd_inspecionados > 0
          ? 'border-emerald-300 bg-emerald-50/20 dark:bg-emerald-950/10'
          : 'border-border bg-card',
      )}
    >
      {/* Header row (always visible) */}
      <button
        type="button"
        className="w-full flex items-center gap-3 px-3 py-3 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="shrink-0">
          {open ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-xs font-black text-foreground">{dep.tipo}</span>
          <span className="text-[11px] text-muted-foreground ml-1.5 truncate">{DEPOSITO_LABELS[dep.tipo]}</span>
        </div>
        {/* Mini-summary badges */}
        {hasActivity ? (
          <div className="flex items-center gap-1.5 shrink-0">
            {dep.qtd_inspecionados > 0 && (
              <span className="text-[10px] font-bold bg-muted px-1.5 py-0.5 rounded-md text-muted-foreground">
                {dep.qtd_inspecionados} inspe.
              </span>
            )}
            {dep.qtd_com_agua > 0 && (
              <span className="text-[10px] font-bold bg-amber-100 dark:bg-amber-900/40 px-1.5 py-0.5 rounded-md text-amber-700 dark:text-amber-400">
                {dep.qtd_com_agua} água
              </span>
            )}
            {dep.qtd_com_focos > 0 && (
              <span className="text-[10px] font-bold bg-rose-100 dark:bg-rose-900/40 px-1.5 py-0.5 rounded-md text-rose-700 dark:text-rose-400">
                {dep.qtd_com_focos} larva
              </span>
            )}
          </div>
        ) : (
          <span className="text-[10px] text-muted-foreground italic shrink-0">Não inspecionado</span>
        )}
      </button>

      {/* Expanded content */}
      {open && (
        <div className="px-3 pb-3 space-y-3 border-t border-border/40 pt-3">
          {/* 3 counters */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-muted-foreground" /> Existentes
              </span>
              <Counter
                value={dep.qtd_inspecionados}
                onChange={(v) => clampedUpdate('qtd_inspecionados', v)}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                <Droplets className="w-3.5 h-3.5" /> Com água
              </span>
              <Counter
                value={dep.qtd_com_agua}
                onChange={(v) => clampedUpdate('qtd_com_agua', v)}
                warning
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                <Bug className="w-3.5 h-3.5" /> Com larva
              </span>
              <Counter
                value={dep.qtd_com_focos}
                onChange={(v) => clampedUpdate('qtd_com_focos', v)}
                danger
              />
            </div>
          </div>

          {/* Eliminado / Vedado — shown when há focos ou água */}
          {(dep.qtd_com_focos > 0 || dep.qtd_com_agua > 0) && (
            <>
              <div className="flex gap-2 pt-1">
                <SmallToggle
                  label="Eliminado"
                  icon={<Trash2 className="w-3.5 h-3.5" />}
                  checked={dep.eliminado}
                  onChange={(v) => clampedUpdate('eliminado', v)}
                  colorClass="border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400"
                />
                <SmallToggle
                  label="Vedado"
                  icon={<Shield className="w-3.5 h-3.5" />}
                  checked={dep.vedado}
                  onChange={(v) => clampedUpdate('vedado', v)}
                  colorClass="border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400"
                />
              </div>
              <IdentificacaoLarvaIA
                depositoTipo={dep.tipo}
                vistoriaId={vistoriaId}
                onResult={(res) => onUpdate({ ...dep, ia_identificacao: res })}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}

function AddCalhaForm({ onAdd }: { onAdd: (c: CalhaRow) => void }) {
  const [pos, setPos] = useState<PosicaoCalha>('frente');
  const [cond, setCond] = useState<CondicaoCalha>('limpa');
  const [foco, setFoco] = useState(false);
  const [expanded, setExpanded] = useState(false);

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="w-full p-3 rounded-xl border-2 border-dashed border-border text-sm text-muted-foreground font-semibold hover:border-primary hover:text-primary transition-colors"
      >
        + Adicionar calha
      </button>
    );
  }

  return (
    <div className="border rounded-xl p-3 space-y-3 bg-muted/30">
      <div className="grid grid-cols-2 gap-2">
        <Select value={pos} onValueChange={(v) => setPos(v as PosicaoCalha)}>
          <SelectTrigger className="rounded-xl text-xs h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            {(Object.keys(POSICAO_CALHA_LABELS) as PosicaoCalha[]).map((p) => (
              <SelectItem key={p} value={p}>{POSICAO_CALHA_LABELS[p]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={cond} onValueChange={(v) => setCond(v as CondicaoCalha)}>
          <SelectTrigger className="rounded-xl text-xs h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            {(Object.keys(CONDICAO_CALHA_LABELS) as CondicaoCalha[]).map((c) => (
              <SelectItem key={c} value={c}>{CONDICAO_CALHA_LABELS[c]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={foco} onChange={(e) => setFoco(e.target.checked)} className="rounded" />
        <span className="text-sm">Identificou foco nesta calha</span>
      </label>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="flex-1 rounded-xl" onClick={() => setExpanded(false)}>Cancelar</Button>
        <Button size="sm" className="flex-1 rounded-xl" onClick={() => {
          onAdd({ posicao: pos, condicao: cond, com_foco: foco, acessivel: true, tratamento_realizado: false, foto_url: null });
          setExpanded(false);
          setFoco(false);
        }}>Adicionar</Button>
      </div>
    </div>
  );
}

export function VistoriaEtapa3Inspecao({ data, onChange, onNext, vistoriaId }: Props) {
  const totalInspecionados = data.depositos.reduce((s, d) => s + d.qtd_inspecionados, 0);
  const totalComAgua = data.depositos.reduce((s, d) => s + d.qtd_com_agua, 0);
  const totalFocos = data.depositos.reduce((s, d) => s + d.qtd_com_focos, 0);

  function updateDeposito(tipo: TipoDeposito, updated: DepositoRow) {
    onChange({
      ...data,
      depositos: data.depositos.map((d) => (d.tipo === tipo ? updated : d)),
    });
  }

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      {totalInspecionados > 0 && (
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-muted/60 px-3 py-2 text-center">
            <p className="text-xl font-black tabular-nums text-foreground">{totalInspecionados}</p>
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">Inspecionados</p>
          </div>
          <div className={cn('rounded-xl px-3 py-2 text-center', totalComAgua > 0 ? 'bg-amber-50 dark:bg-amber-950/30' : 'bg-muted/60')}>
            <p className={cn('text-xl font-black tabular-nums', totalComAgua > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-foreground')}>{totalComAgua}</p>
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">Com água</p>
          </div>
          <div className={cn('rounded-xl px-3 py-2 text-center', totalFocos > 0 ? 'bg-rose-50 dark:bg-rose-950/30' : 'bg-muted/60')}>
            <p className={cn('text-xl font-black tabular-nums', totalFocos > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-foreground')}>{totalFocos}</p>
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">Com larva</p>
          </div>
        </div>
      )}

      <Card className="rounded-2xl border-border">
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center gap-2 mb-2">
            <Layers className="w-4 h-4 text-primary" />
            <p className="text-xs font-semibold text-primary uppercase tracking-wider">Depósitos PNCD</p>
            <span className="text-[10px] text-muted-foreground ml-auto">Toque para expandir</span>
          </div>

          {data.depositos.map((dep) => (
            <DepositoAccordion
              key={dep.tipo}
              dep={dep}
              vistoriaId={vistoriaId}
              onUpdate={(updated) => updateDeposito(dep.tipo, updated)}
            />
          ))}
        </CardContent>
      </Card>

      {totalFocos > 0 && (
        <div className="flex items-start gap-3 p-4 rounded-2xl border-2 border-rose-400/50 bg-rose-50/60 dark:bg-rose-950/20">
          <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
          <p className="text-sm text-rose-700 dark:text-rose-400 font-semibold">
            {totalFocos} depósito{totalFocos !== 1 ? 's' : ''} com larva identificad{totalFocos !== 1 ? 'os' : 'o'}.
            Registre o tratamento na próxima etapa.
          </p>
        </div>
      )}

      {/* Seção de Calhas */}
      <Card className="rounded-2xl border-border">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <Wrench className="w-4 h-4 text-primary" />
            <p className="text-xs font-semibold text-primary uppercase tracking-wider">Calhas</p>
          </div>

          <button
            type="button"
            onClick={() => onChange({ ...data, tem_calha: !data.tem_calha })}
            className={cn(
              'flex items-center gap-3 w-full p-3.5 rounded-xl border-2 transition-all text-left',
              data.tem_calha
                ? 'border-primary bg-primary/5 text-primary'
                : 'border-border bg-card text-foreground hover:border-muted-foreground/40',
            )}
          >
            <span className="text-sm font-semibold flex-1">O imóvel possui calha?</span>
            <span className={cn('w-10 h-6 rounded-full border-2 transition-colors flex items-center px-0.5 shrink-0', data.tem_calha ? 'bg-primary border-primary justify-end' : 'bg-muted border-border justify-start')}>
              <span className="w-4 h-4 rounded-full bg-white shadow" />
            </span>
          </button>

          {data.tem_calha && (
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => onChange({ ...data, calha_inacessivel: !data.calha_inacessivel })}
                className={cn(
                  'flex items-center gap-3 w-full p-3 rounded-xl border-2 transition-all text-left',
                  data.calha_inacessivel
                    ? 'border-amber-400 bg-amber-50/40 text-amber-700'
                    : 'border-border bg-card text-foreground',
                )}
              >
                <AlertCircle className={cn('w-4 h-4 shrink-0', data.calha_inacessivel ? 'text-amber-500' : 'text-muted-foreground')} />
                <span className="text-sm font-semibold flex-1">Calha inacessível (muito alta)</span>
                <span className={cn('w-10 h-6 rounded-full border-2 transition-colors flex items-center px-0.5 shrink-0', data.calha_inacessivel ? 'bg-amber-400 border-amber-400 justify-end' : 'bg-muted border-border justify-start')}>
                  <span className="w-4 h-4 rounded-full bg-white shadow" />
                </span>
              </button>

              {!data.calha_inacessivel && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Calhas inspecionadas</p>
                  {(data.calhas ?? []).map((calha, idx) => (
                    <div key={idx} className={cn('rounded-xl border p-3 space-y-2', calha.com_foco ? 'border-rose-300 bg-rose-50/40' : 'border-emerald-300 bg-emerald-50/30')}>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold">{POSICAO_CALHA_LABELS[calha.posicao]}</span>
                        <button
                          type="button"
                          onClick={() => onChange({ ...data, calhas: data.calhas.filter((_, i) => i !== idx) })}
                          className="text-xs text-muted-foreground hover:text-destructive"
                        >
                          Remover
                        </button>
                      </div>
                      <p className="text-xs text-muted-foreground">{CONDICAO_CALHA_LABELS[calha.condicao]}{calha.com_foco ? ' — com foco' : ''}</p>
                    </div>
                  ))}
                  <AddCalhaForm onAdd={(c) => onChange({ ...data, calhas: [...data.calhas, c] })} />
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Button className="w-full h-12 rounded-xl text-base font-bold" onClick={onNext}>
        Avançar
      </Button>
    </div>
  );
}
