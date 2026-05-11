import { Building2, CheckCircle2, AlertCircle, Activity, Map, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  totalRegioes: number;
  totalQuadras: number;
  comGeometria: number;
  semGeometria: number;
  atribuidos: number;
  semAtribuicao: number;
  pendentes: number;
  totalImoveis: number;
  totalVisitados: number;
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

export function DistribuicaoKpiCards({
  totalRegioes, totalQuadras, comGeometria, semGeometria,
  atribuidos, semAtribuicao, pendentes, totalImoveis, totalVisitados,
}: Props) {
  const pctAtrib = totalQuadras > 0 ? Math.round((atribuidos / totalQuadras) * 100) : 0;
  const pctGeom  = totalQuadras > 0 ? Math.round((comGeometria / totalQuadras) * 100) : 0;
  const pctCob   = totalImoveis > 0 ? Math.round((totalVisitados / totalImoveis) * 100) : 0;

  const colorAtrib = pctAtrib === 100 ? '#10b981' : pctAtrib > 50 ? '#f59e0b' : totalQuadras > 0 ? '#ef4444' : '#94a3b8';
  const colorGeom  = pctGeom === 100 ? '#10b981' : pctGeom > 50 ? '#f59e0b' : totalQuadras > 0 ? '#ef4444' : '#94a3b8';
  const colorCob   = pctCob >= 80 ? '#10b981' : pctCob > 40 ? '#f59e0b' : '#94a3b8';

  const borderAtrib = pctAtrib === 100 ? 'border-l-emerald-500' : pctAtrib > 50 ? 'border-l-amber-400' : totalQuadras > 0 ? 'border-l-red-400' : 'border-l-slate-300/60';
  const borderGeom  = pctGeom === 100 ? 'border-l-emerald-500' : pctGeom > 50 ? 'border-l-amber-400' : totalQuadras > 0 ? 'border-l-red-400' : 'border-l-slate-300/60';
  const borderCob   = pctCob >= 80 ? 'border-l-emerald-500' : pctCob > 40 ? 'border-l-amber-400' : 'border-l-slate-300/60';

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">

      {/* Bairros */}
      <div className="rounded-xl border bg-card border-l-[3px] border-l-slate-300/60 px-3 py-2.5 flex flex-col gap-1 shadow-sm">
        <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          <Map className="h-3 w-3 shrink-0" />
          Bairros
        </div>
        <p className="text-3xl font-bold tabular-nums leading-none mt-0.5">{totalRegioes}</p>
        <p className="text-[10px] text-muted-foreground/60 leading-none">regiões territoriais</p>
      </div>

      {/* Quadras */}
      <div className="rounded-xl border bg-card border-l-[3px] border-l-slate-300/60 px-3 py-2.5 flex flex-col gap-1 shadow-sm">
        <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          <Building2 className="h-3 w-3 shrink-0" />
          Quadras
        </div>
        <p className="text-3xl font-bold tabular-nums leading-none mt-0.5">{totalQuadras}</p>
        <p className="text-[10px] text-muted-foreground/60 leading-none">unidades territoriais</p>
      </div>

      {/* Geometria */}
      <div className={cn('rounded-xl border bg-card border-l-[3px] px-3 py-2.5 flex flex-col gap-1 shadow-sm', borderGeom)}>
        <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          <MapPin className="h-3 w-3 shrink-0" style={{ color: colorGeom }} />
          No mapa
        </div>
        <div className="flex items-end gap-1 leading-none mt-0.5">
          <p className="text-3xl font-bold tabular-nums" style={{ color: comGeometria > 0 ? colorGeom : undefined }}>
            {comGeometria}
          </p>
          <span className="text-sm text-muted-foreground/50 pb-0.5">/{totalQuadras}</span>
        </div>
        <MiniBar value={pctGeom} color={colorGeom} />
        <p className="text-[10px] text-muted-foreground/60 leading-none">{pctGeom}% · {semGeometria} faltando</p>
      </div>

      {/* Atribuídas */}
      <div className={cn('rounded-xl border bg-card border-l-[3px] px-3 py-2.5 flex flex-col gap-1 shadow-sm', borderAtrib)}>
        <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          <CheckCircle2 className="h-3 w-3 shrink-0" style={{ color: colorAtrib }} />
          Atribuídas
        </div>
        <div className="flex items-end gap-1 leading-none mt-0.5">
          <p className="text-3xl font-bold tabular-nums" style={{ color: atribuidos > 0 ? colorAtrib : undefined }}>
            {atribuidos}
          </p>
          <span className="text-sm text-muted-foreground/50 pb-0.5">/{totalQuadras}</span>
        </div>
        <MiniBar value={pctAtrib} color={colorAtrib} />
        <p className="text-[10px] text-muted-foreground/60 leading-none">{pctAtrib}% do total</p>
      </div>

      {/* Pendentes */}
      <div className={cn(
        'rounded-xl border bg-card border-l-[3px] px-3 py-2.5 flex flex-col gap-1 shadow-sm',
        semAtribuicao === 0 ? 'border-l-emerald-500' : 'border-l-amber-400',
      )}>
        <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          <AlertCircle className="h-3 w-3 shrink-0 text-amber-500" />
          Pendentes
        </div>
        <p className={cn(
          'text-3xl font-bold tabular-nums leading-none mt-0.5',
          semAtribuicao > 0 ? 'text-amber-600' : 'text-emerald-600',
        )}>
          {semAtribuicao}
        </p>
        {pendentes > 0 ? (
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
            <span className="text-[10px] text-amber-600 font-semibold leading-none">{pendentes} não salvas</span>
          </div>
        ) : (
          <p className="text-[10px] text-muted-foreground/60 leading-none">sem agente definido</p>
        )}
      </div>

      {/* Cobertura */}
      <div className={cn('rounded-xl border bg-card border-l-[3px] px-3 py-2.5 flex flex-col gap-1 shadow-sm', borderCob)}>
        <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          <Activity className="h-3 w-3 shrink-0" />
          Cobertura
        </div>
        {totalImoveis > 0 ? (
          <>
            <p className="text-3xl font-bold tabular-nums leading-none mt-0.5" style={{ color: colorCob }}>
              {pctCob}%
            </p>
            <MiniBar value={pctCob} color={colorCob} />
            <p className="text-[10px] text-muted-foreground/60 leading-none">{totalVisitados}/{totalImoveis} im.</p>
          </>
        ) : (
          <>
            <p className="text-3xl font-bold text-muted-foreground/30 leading-none mt-0.5">—</p>
            <p className="text-[10px] text-muted-foreground/60 leading-none">sem dados do ciclo</p>
          </>
        )}
      </div>

    </div>
  );
}
