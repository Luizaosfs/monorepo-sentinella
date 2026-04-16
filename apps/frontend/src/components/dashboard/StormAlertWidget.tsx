import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CloudLightning, Droplets, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useStormAlerts, WeatherAlert } from '@/hooks/queries/useStormAlerts';

function severityColor(sev: string) {
  switch (sev) {
    case 'critico': return 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30';
    case 'alto': return 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30';
    default: return 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/30';
  }
}

function severityIcon(sev: string) {
  switch (sev) {
    case 'critico': return <AlertTriangle className="w-4 h-4 text-red-500" />;
    case 'alto': return <CloudLightning className="w-4 h-4 text-orange-500" />;
    default: return <Droplets className="w-4 h-4 text-yellow-500" />;
  }
}

export function StormAlertWidget({ clienteId }: { clienteId: string }) {
  const [expanded, setExpanded] = useState(false);
  const { data: alerts = [], isLoading: loading } = useStormAlerts(clienteId);

  const criticalCount = alerts.filter((a) => a.severity === 'critico').length;
  const highCount = alerts.filter((a) => a.severity === 'alto').length;
  const displayAlerts = expanded ? alerts : alerts.slice(0, 5);

  return (
    <Card className="rounded-2xl shadow-sm border-border/60 bg-card overflow-hidden animate-fade-in">
      <CardHeader className="flex flex-row items-center justify-between p-5 border-b border-border/60">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center">
            <CloudLightning className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <CardTitle className="text-base font-bold text-foreground">Alertas de Tempestades</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">Previsão meteorológica dos próximos 3 dias</p>
          </div>
        </div>
        <div className="flex gap-2">
          {criticalCount > 0 && (
            <Badge variant="outline" className="bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30 font-bold text-[10px]">
              {criticalCount} crítico{criticalCount > 1 ? 's' : ''}
            </Badge>
          )}
          {highCount > 0 && (
            <Badge variant="outline" className="bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30 font-bold text-[10px]">
              {highCount} alto{highCount > 1 ? 's' : ''}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-3 border border-emerald-500/20">
              <Droplets className="w-6 h-6 text-emerald-500 opacity-60" />
            </div>
            <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">Sem alertas ativos</p>
            <p className="text-xs mt-1 opacity-70">Nenhuma previsão de chuva forte nos próximos 3 dias.</p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-border/40">
              {displayAlerts.map((alert: WeatherAlert, i: number) => (
                <div key={i} className="flex items-start gap-3 p-4 hover:bg-muted/30 transition-colors">
                  <div className={`mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    alert.severity === 'critico' ? 'bg-red-500/10' :
                    alert.severity === 'alto' ? 'bg-orange-500/10' : 'bg-yellow-500/10'
                  }`}>
                    {severityIcon(alert.severity)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-foreground">{alert.regiao}</span>
                      <Badge variant="outline" className={`text-[10px] font-bold ${severityColor(alert.severity)}`}>
                        {alert.type}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 font-medium">{alert.message}</p>
                  </div>
                  <span className="text-[10px] font-bold text-muted-foreground uppercase shrink-0">{alert.day}</span>
                </div>
              ))}
            </div>
            {alerts.length > 5 && (
              <div className="p-3 border-t border-border/40 text-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setExpanded(!expanded)}
                  className="text-xs font-bold gap-1"
                >
                  {expanded ? (
                    <>Mostrar menos <ChevronUp className="w-3 h-3" /></>
                  ) : (
                    <>Ver todos os {alerts.length} alertas <ChevronDown className="w-3 h-3" /></>
                  )}
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
