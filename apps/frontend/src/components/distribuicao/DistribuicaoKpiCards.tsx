import { Building2, CheckCircle2, AlertCircle, Activity, Map, MapPin } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
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

export function DistribuicaoKpiCards({
  totalRegioes, totalQuadras, comGeometria, semGeometria,
  atribuidos, semAtribuicao, pendentes, totalImoveis, totalVisitados,
}: Props) {
  const pctAtrib = totalQuadras > 0 ? Math.round((atribuidos / totalQuadras) * 100) : 0;
  const pctGeom  = totalQuadras > 0 ? Math.round((comGeometria / totalQuadras) * 100) : 0;
  const pctCob   = totalImoveis > 0 ? Math.round((totalVisitados / totalImoveis) * 100) : 0;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
      {/* Bairros */}
      <Card className="overflow-hidden">
        <div className="h-0.5 bg-slate-300/60" />
        <CardContent className="pt-3 pb-3">
          <div className="flex items-center gap-1.5 text-muted-foreground text-[10px] uppercase tracking-wide mb-2">
            <Map className="h-3 w-3" />
            Bairros
          </div>
          <p className="text-2xl font-bold tabular-nums">{totalRegioes}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">regiões territoriais</p>
        </CardContent>
      </Card>

      {/* Quadras */}
      <Card className="overflow-hidden">
        <div className="h-0.5 bg-slate-300/60" />
        <CardContent className="pt-3 pb-3">
          <div className="flex items-center gap-1.5 text-muted-foreground text-[10px] uppercase tracking-wide mb-2">
            <Building2 className="h-3 w-3" />
            Quadras
          </div>
          <p className="text-2xl font-bold tabular-nums">{totalQuadras}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">unidades territoriais</p>
        </CardContent>
      </Card>

      {/* Geometria */}
      <Card className="overflow-hidden">
        <div className={cn('h-0.5', pctGeom === 100 ? 'bg-emerald-400' : pctGeom > 50 ? 'bg-amber-300' : 'bg-red-300/70')} />
        <CardContent className="pt-3 pb-3">
          <div className="flex items-center gap-1.5 text-muted-foreground text-[10px] uppercase tracking-wide mb-2">
            <MapPin className="h-3 w-3 text-emerald-500" />
            No mapa
          </div>
          <p className={cn('text-2xl font-bold tabular-nums', comGeometria > 0 ? 'text-emerald-600' : 'text-muted-foreground')}>
            {comGeometria}
          </p>
          <div className="mt-1.5 space-y-1">
            <Progress value={pctGeom} className="h-1" />
            <p className="text-[10px] text-muted-foreground">{pctGeom}% ({semGeometria} faltando)</p>
          </div>
        </CardContent>
      </Card>

      {/* Atribuídas */}
      <Card className="overflow-hidden">
        <div className={cn('h-0.5', pctAtrib === 100 ? 'bg-emerald-400' : pctAtrib > 50 ? 'bg-amber-300' : 'bg-red-300/70')} />
        <CardContent className="pt-3 pb-3">
          <div className="flex items-center gap-1.5 text-muted-foreground text-[10px] uppercase tracking-wide mb-2">
            <CheckCircle2 className="h-3 w-3 text-emerald-500" />
            Atribuídas
          </div>
          <p className={cn('text-2xl font-bold tabular-nums', atribuidos > 0 ? 'text-emerald-600' : 'text-muted-foreground')}>
            {atribuidos}
          </p>
          <div className="mt-1.5 space-y-1">
            <Progress value={pctAtrib} className="h-1" />
            <p className="text-[10px] text-muted-foreground">{pctAtrib}% do total</p>
          </div>
        </CardContent>
      </Card>

      {/* Pendentes */}
      <Card className="overflow-hidden">
        <div className={cn('h-0.5', semAtribuicao === 0 ? 'bg-emerald-400' : 'bg-amber-300')} />
        <CardContent className="pt-3 pb-3">
          <div className="flex items-center gap-1.5 text-muted-foreground text-[10px] uppercase tracking-wide mb-2">
            <AlertCircle className="h-3 w-3 text-amber-500" />
            Pendentes
          </div>
          <p className={cn('text-2xl font-bold tabular-nums', semAtribuicao > 0 ? 'text-amber-600' : 'text-emerald-600')}>
            {semAtribuicao}
          </p>
          {pendentes > 0 ? (
            <Badge className="mt-1.5 text-[9px] bg-amber-500/15 text-amber-700 border-transparent h-4 px-1.5">
              {pendentes} não salvas
            </Badge>
          ) : (
            <p className="text-[10px] text-muted-foreground mt-0.5">sem agente definido</p>
          )}
        </CardContent>
      </Card>

      {/* Cobertura */}
      <Card className="overflow-hidden">
        <div className={cn('h-0.5', pctCob >= 80 ? 'bg-emerald-400' : pctCob > 40 ? 'bg-amber-300' : 'bg-slate-300/60')} />
        <CardContent className="pt-3 pb-3">
          <div className="flex items-center gap-1.5 text-muted-foreground text-[10px] uppercase tracking-wide mb-2">
            <Activity className="h-3 w-3" />
            Cobertura
          </div>
          {totalImoveis > 0 ? (
            <>
              <p className="text-2xl font-bold tabular-nums">{pctCob}%</p>
              <div className="mt-1.5 space-y-1">
                <Progress value={pctCob} className="h-1" />
                <p className="text-[10px] text-muted-foreground">{totalVisitados}/{totalImoveis} im.</p>
              </div>
            </>
          ) : (
            <>
              <p className="text-2xl font-bold text-muted-foreground">—</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">sem dados do ciclo</p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
