import { Building2, CheckCircle2, AlertCircle, Activity, Map, MapPin } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

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
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-1.5 text-muted-foreground text-[11px] mb-1.5">
            <Map className="h-3.5 w-3.5" />
            Regiões
          </div>
          <p className="text-2xl font-bold tabular-nums">{totalRegioes}</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-1.5 text-muted-foreground text-[11px] mb-1.5">
            <Building2 className="h-3.5 w-3.5" />
            Quadras
          </div>
          <p className="text-2xl font-bold tabular-nums">{totalQuadras}</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-1.5 text-muted-foreground text-[11px] mb-1.5">
            <MapPin className="h-3.5 w-3.5 text-emerald-500" />
            Com geometria
          </div>
          <p className="text-2xl font-bold tabular-nums text-emerald-600">{comGeometria}</p>
          <div className="mt-1.5 space-y-0.5">
            <Progress value={pctGeom} className="h-1.5" />
            <p className="text-[10px] text-muted-foreground">{pctGeom}% — {semGeometria} sem</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-1.5 text-muted-foreground text-[11px] mb-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            Atribuídas
          </div>
          <p className="text-2xl font-bold tabular-nums text-emerald-600">{atribuidos}</p>
          <div className="mt-1.5 space-y-0.5">
            <Progress value={pctAtrib} className="h-1.5" />
            <p className="text-[10px] text-muted-foreground">{pctAtrib}% do total</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-1.5 text-muted-foreground text-[11px] mb-1.5">
            <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
            Sem atribuição
          </div>
          <p className="text-2xl font-bold tabular-nums text-amber-600">{semAtribuicao}</p>
          {pendentes > 0 && (
            <Badge className="mt-1 text-[9px] bg-amber-500/15 text-amber-700 border-transparent">
              {pendentes} pendente(s)
            </Badge>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-1.5 text-muted-foreground text-[11px] mb-1.5">
            <Activity className="h-3.5 w-3.5" />
            Cobertura
          </div>
          {totalImoveis > 0 ? (
            <>
              <p className="text-2xl font-bold tabular-nums">{pctCob}%</p>
              <div className="mt-1.5 space-y-0.5">
                <Progress value={pctCob} className="h-1.5" />
                <p className="text-[10px] text-muted-foreground">
                  {totalVisitados}/{totalImoveis} im.
                </p>
              </div>
            </>
          ) : (
            <p className="text-2xl font-bold text-muted-foreground">—</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
