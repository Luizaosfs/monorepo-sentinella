import { Droplets, AlertTriangle, CloudRain, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import { useClienteAtivo } from '@/hooks/useClienteAtivo';
import { usePluvioAlertaTerritorial } from '@/hooks/queries/usePluvioAlertaTerritorial';
import type { NivelRiscoPluvio, AlertaTerritorialItem } from '@/services/api/domains/pluvio';

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

const BANNER_BG: Record<NivelRiscoPluvio, string> = {
  critico: 'bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300',
  alto:    'bg-orange-500/10 border-orange-500/30 text-orange-700 dark:text-orange-300',
  medio:   'bg-yellow-500/10 border-yellow-500/30 text-yellow-700 dark:text-yellow-300',
  baixo:   'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300',
};

function AlertaRow({ alerta }: { alerta: AlertaTerritorialItem }) {
  return (
    <div className="p-4 hover:bg-muted/30 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
            alerta.nivelRiscoPluvio === 'critico' ? 'bg-red-500/10' :
            alerta.nivelRiscoPluvio === 'alto' ? 'bg-orange-500/10' : 'bg-yellow-500/10'
          }`}>
            <AlertTriangle className={`w-4 h-4 ${
              alerta.nivelRiscoPluvio === 'critico' ? 'text-red-500' :
              alerta.nivelRiscoPluvio === 'alto' ? 'text-orange-500' : 'text-yellow-500'
            }`} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-foreground">{alerta.regiaoNome}</span>
              <Badge variant="outline" className={`text-[10px] font-bold ${SEV_COLOR[alerta.nivelRiscoPluvio]}`}>
                {SEV_LABEL[alerta.nivelRiscoPluvio]}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{alerta.recomendacao}</p>
          </div>
        </div>
        <div className="text-right shrink-0 space-y-0.5">
          <p className="text-xs font-bold text-foreground">{alerta.chuva24hMm.toFixed(1)}<span className="font-normal text-muted-foreground">mm/24h</span></p>
          <p className="text-xs text-muted-foreground">{alerta.chuva72hMm.toFixed(1)}mm/72h</p>
        </div>
      </div>
      {alerta.justificativas.length > 0 && (
        <div className="mt-2 ml-11 flex flex-wrap gap-1">
          {alerta.justificativas.map((j, i) => (
            <span key={i} className="text-[10px] bg-muted/60 rounded px-2 py-0.5 text-muted-foreground">{j}</span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function GestorPluvioAlertaTerritorial() {
  const { clienteId } = useClienteAtivo();
  const { data, isLoading, isError } = usePluvioAlertaTerritorial(clienteId);

  return (
    <div className="flex flex-col gap-6 p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
          <CloudRain className="w-6 h-6 text-blue-500" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Alerta Pluviométrico Territorial</h1>
          <p className="text-sm text-muted-foreground">Regiões em risco preventivo por chuva acumulada</p>
        </div>
      </div>

      {isLoading && (
        <div className="flex justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {isError && (
        <Card className="rounded-2xl border-border/60">
          <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <CloudRain className="w-8 h-8 opacity-30 mb-2" />
            <p className="text-sm">Dados pluviométricos temporariamente indisponíveis</p>
          </CardContent>
        </Card>
      )}

      {data && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="rounded-2xl border-border/60">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-foreground">{data.totalRegioesEmAlerta}</p>
                <p className="text-xs text-muted-foreground mt-1">Regiões em alerta</p>
              </CardContent>
            </Card>
            <Card className="rounded-2xl border-border/60">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-foreground">{data.totalRegioesMonitoradas}</p>
                <p className="text-xs text-muted-foreground mt-1">Monitoradas</p>
              </CardContent>
            </Card>
            <Card className="rounded-2xl border-border/60">
              <CardContent className="p-4 text-center">
                <Badge variant="outline" className={`text-sm font-bold px-3 py-1 ${SEV_COLOR[data.severidadeGeral]}`}>
                  {SEV_LABEL[data.severidadeGeral]}
                </Badge>
                <p className="text-xs text-muted-foreground mt-2">Severidade geral</p>
              </CardContent>
            </Card>
            <Card className="rounded-2xl border-border/60">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-foreground">
                  {data.alertas.length > 0
                    ? Math.max(...data.alertas.map((a) => a.chuva72hMm)).toFixed(0)
                    : '—'}
                  <span className="text-sm font-normal">mm</span>
                </p>
                <p className="text-xs text-muted-foreground mt-1">Máx. chuva 72h</p>
              </CardContent>
            </Card>
          </div>

          {/* Status banner */}
          {data.severidadeGeral !== 'baixo' && (
            <div className={`rounded-xl border p-4 flex items-start gap-2 ${BANNER_BG[data.severidadeGeral]}`}>
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="text-sm font-medium">
                {data.severidadeGeral === 'critico'
                  ? 'Risco crítico detectado — priorizar vistoria preventiva nas próximas 24h.'
                  : data.severidadeGeral === 'alto'
                  ? 'Risco alto detectado — reforçar cobertura territorial nas próximas 48h.'
                  : 'Risco médio detectado — monitorar e manter rota preventiva.'}
              </div>
            </div>
          )}

          {/* Alerts table */}
          <Card className="rounded-2xl border-border/60 overflow-hidden">
            <CardHeader className="p-5 border-b border-border/60">
              <CardTitle className="text-base font-bold">
                {data.alertas.length > 0
                  ? `${data.alertas.length} região${data.alertas.length > 1 ? 'ões' : ''} em alerta`
                  : 'Sem regiões em alerta'}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {data.alertas.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-3">
                    <Droplets className="w-6 h-6 text-emerald-500 opacity-60" />
                  </div>
                  <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">Todas as regiões em nível baixo</p>
                  <p className="text-xs mt-1 opacity-70">Nenhum risco pluviométrico preventivo ativo.</p>
                </div>
              ) : (
                <div className="divide-y divide-border/40">
                  {data.alertas.map((alerta) => (
                    <AlertaRow key={alerta.regiaoId} alerta={alerta} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Disclaimer */}
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>
              Risco pluviométrico é preventivo territorial — não cria focos operacionais.
              Dados atualizados diariamente às 06h via Open-Meteo.
              Atualizado em {new Date(data.atualizadoEm).toLocaleString('pt-BR')}.
            </span>
          </div>
        </>
      )}
    </div>
  );
}
