import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Droplets, AlertTriangle, ArrowRight } from 'lucide-react';
import { usePluvioAlertaTerritorial } from '@/hooks/queries/usePluvioAlertaTerritorial';
import type { NivelRiscoPluvio } from '@/services/api/domains/pluvio';

const SEV_COLOR: Record<NivelRiscoPluvio, string> = {
  critico: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30',
  alto:    'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30',
  medio:   'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/30',
  baixo:   'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
};

const SEV_LABEL: Record<NivelRiscoPluvio, string> = {
  critico: 'Crítico',
  alto:    'Alto',
  medio:   'Médio',
  baixo:   'Baixo',
};

export function PluvioAlertaWidget({ clienteId }: { clienteId: string }) {
  const { data, isError } = usePluvioAlertaTerritorial(clienteId);

  if (isError || !data || data.totalRegioesEmAlerta === 0) return null;

  const { severidadeGeral, totalRegioesEmAlerta, totalRegioesMonitoradas, alertas } = data;
  const top = alertas[0];
  const maxChuva72h = Math.max(...alertas.map((a) => a.chuva72hMm));

  return (
    <Card className="rounded-2xl shadow-sm border-border/60 bg-card overflow-hidden animate-fade-in">
      <CardHeader className="flex flex-row items-center justify-between p-5 border-b border-border/60">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center">
            <Droplets className="w-5 h-5 text-blue-500" />
          </div>
          <div>
            <CardTitle className="text-base font-bold text-foreground">Alerta Pluviométrico</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">Risco territorial por chuva acumulada</p>
          </div>
        </div>
        <Badge variant="outline" className={`font-bold text-[10px] ${SEV_COLOR[severidadeGeral]}`}>
          {SEV_LABEL[severidadeGeral]}
        </Badge>
      </CardHeader>
      <CardContent className="p-5 space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl bg-muted/40 p-3 text-center">
            <p className="text-xl font-bold text-foreground">{totalRegioesEmAlerta}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">Bairros<br/>em alerta</p>
          </div>
          <div className="rounded-xl bg-muted/40 p-3 text-center">
            <p className="text-xl font-bold text-foreground">{totalRegioesMonitoradas}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">Bairros<br/>monitorados</p>
          </div>
          <div className="rounded-xl bg-muted/40 p-3 text-center">
            <p className="text-xl font-bold text-foreground">{maxChuva72h.toFixed(0)}<span className="text-xs font-normal">mm</span></p>
            <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">Máx. chuva<br/>72h</p>
          </div>
        </div>

        {top && (
          <div className="rounded-xl border border-border/40 p-3 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-xs font-bold text-foreground truncate">{top.regiaoNome}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug line-clamp-2">{top.recomendacao}</p>
            </div>
          </div>
        )}

        <Button asChild variant="outline" size="sm" className="w-full gap-1 font-bold text-xs">
          <Link to="/gestor/pluvio/alerta-territorial">
            Ver alerta territorial <ArrowRight className="w-3 h-3" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
