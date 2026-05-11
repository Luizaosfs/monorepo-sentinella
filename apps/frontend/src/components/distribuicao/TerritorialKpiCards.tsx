import { Building2, CheckCircle2, AlertCircle, Users, BarChart2, Map } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  totalRegioes: number;
  totalQuadras: number;
  atribuidas: number;
  semResponsavel: number;
  agentesAtivos: number;
  mediaQuadrasAgente: number;
}

function MiniBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="h-1.5 w-full rounded-full bg-muted/40 overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${Math.min(100, Math.max(0, value))}%`, backgroundColor: color }}
      />
    </div>
  );
}

export function TerritorialKpiCards({
  totalRegioes,
  totalQuadras,
  atribuidas,
  semResponsavel,
  agentesAtivos,
  mediaQuadrasAgente,
}: Props) {
  const pctAtrib = totalQuadras > 0 ? Math.round((atribuidas / totalQuadras) * 100) : 0;
  const colorAtrib = pctAtrib === 100 ? '#10b981' : pctAtrib > 50 ? '#f59e0b' : totalQuadras > 0 ? '#ef4444' : '#94a3b8';
  const borderAtrib = pctAtrib === 100 ? 'border-l-emerald-500' : pctAtrib > 50 ? 'border-l-amber-400' : totalQuadras > 0 ? 'border-l-red-400' : 'border-l-slate-300/60';
  const borderSem = semResponsavel === 0 ? 'border-l-emerald-500' : semResponsavel > 0 ? 'border-l-red-400' : 'border-l-slate-300/60';

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">

      <div className="rounded-xl border bg-card border-l-[3px] border-l-slate-300/60 px-3 py-2.5 flex flex-col gap-1 shadow-sm">
        <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          <Map className="h-3 w-3 shrink-0" />
          Bairros
        </div>
        <p className="text-3xl font-bold tabular-nums leading-none mt-0.5">{totalRegioes}</p>
        <p className="text-[10px] text-muted-foreground/60 leading-none">regiões territoriais</p>
      </div>

      <div className="rounded-xl border bg-card border-l-[3px] border-l-slate-300/60 px-3 py-2.5 flex flex-col gap-1 shadow-sm">
        <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          <Building2 className="h-3 w-3 shrink-0" />
          Quadras
        </div>
        <p className="text-3xl font-bold tabular-nums leading-none mt-0.5">{totalQuadras}</p>
        <p className="text-[10px] text-muted-foreground/60 leading-none">unidades territoriais</p>
      </div>

      <div className={cn('rounded-xl border bg-card border-l-[3px] px-3 py-2.5 flex flex-col gap-1 shadow-sm', borderAtrib)}>
        <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          <CheckCircle2 className="h-3 w-3 shrink-0" style={{ color: colorAtrib }} />
          Atribuídas
        </div>
        <div className="flex items-end gap-1 leading-none mt-0.5">
          <p className="text-3xl font-bold tabular-nums" style={{ color: atribuidas > 0 ? colorAtrib : undefined }}>
            {atribuidas}
          </p>
          <span className="text-sm text-muted-foreground/50 pb-0.5">/{totalQuadras}</span>
        </div>
        <MiniBar value={pctAtrib} color={colorAtrib} />
        <p className="text-[10px] text-muted-foreground/60 leading-none">{pctAtrib}% do total</p>
      </div>

      <div className={cn('rounded-xl border bg-card border-l-[3px] px-3 py-2.5 flex flex-col gap-1 shadow-sm', borderSem)}>
        <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          <AlertCircle className="h-3 w-3 shrink-0 text-red-500" />
          Sem responsável
        </div>
        <p className={cn(
          'text-3xl font-bold tabular-nums leading-none mt-0.5',
          semResponsavel > 0 ? 'text-red-600' : 'text-emerald-600',
        )}>
          {semResponsavel}
        </p>
        <p className="text-[10px] text-muted-foreground/60 leading-none">
          {semResponsavel === 0 ? 'todas atribuídas' : 'quadras sem agente'}
        </p>
      </div>

      <div className="rounded-xl border bg-card border-l-[3px] border-l-slate-300/60 px-3 py-2.5 flex flex-col gap-1 shadow-sm">
        <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          <Users className="h-3 w-3 shrink-0" />
          Agentes ativos
        </div>
        <p className="text-3xl font-bold tabular-nums leading-none mt-0.5">{agentesAtivos}</p>
        <p className="text-[10px] text-muted-foreground/60 leading-none">com território definido</p>
      </div>

      <div className="rounded-xl border bg-card border-l-[3px] border-l-slate-300/60 px-3 py-2.5 flex flex-col gap-1 shadow-sm">
        <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          <BarChart2 className="h-3 w-3 shrink-0" />
          Média/agente
        </div>
        <p className="text-3xl font-bold tabular-nums leading-none mt-0.5">
          {agentesAtivos > 0 ? mediaQuadrasAgente : '—'}
        </p>
        <p className="text-[10px] text-muted-foreground/60 leading-none">quadras por agente</p>
      </div>

    </div>
  );
}
