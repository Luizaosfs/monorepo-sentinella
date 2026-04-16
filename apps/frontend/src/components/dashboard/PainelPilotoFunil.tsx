/**
 * PainelPilotoFunil — Observabilidade operacional do piloto
 * Funil triagem → despacho → campo · produtividade por agente · despachos por supervisor
 * Fonte: v_piloto_funil_hoje, v_piloto_despachos_supervisor, v_piloto_prod_agentes
 */
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AlertTriangle, ArrowRight, Clock, Users, CheckCircle2, Inbox } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { usePilotoFunil, usePilotoDespachosSupervisor, usePilotoProdAgentes } from '@/hooks/queries/usePainelPiloto';

// ── Helpers ──────────────────────────────────────────────────────────────────

function horas(h: number | null | undefined): string {
  if (h == null) return '—';
  if (h < 1) return `${Math.round(h * 60)} min`;
  return `${h.toFixed(1)} h`;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function KpiBox({
  label,
  value,
  sub,
  alert,
}: {
  label: string;
  value: number | string;
  sub?: string;
  alert?: boolean;
}) {
  return (
    <div className={`rounded-xl border px-3 py-2.5 text-center ${alert ? 'border-red-200 bg-red-50/60 dark:border-red-800/40 dark:bg-red-950/20' : 'border-border bg-muted/30'}`}>
      <p className={`text-2xl font-bold tabular-nums leading-none ${alert ? 'text-red-600' : 'text-foreground'}`}>{value}</p>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide mt-1">{label}</p>
      {sub && <p className="text-[10px] text-muted-foreground/70 mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function PainelPilotoFunil() {
  const { data: funil, isLoading: funilLoading } = usePilotoFunil();
  const { data: supervisores = [] } = usePilotoDespachosSupervisor();
  const { data: agentes = [] } = usePilotoProdAgentes();

  const origens = funil?.entradas_por_origem_hoje;
  const origemLabels: Record<string, string> = {
    drone: 'Drone', cidadao: 'Cidadão', agente: 'Agente', manual: 'Manual', pluvio: 'Pluvio',
  };
  const origemAtivas = origens
    ? (Object.entries(origens) as [string, number][]).filter(([, v]) => v > 0)
    : [];

  const temAlerta = (funil?.envelhecidos_24h ?? 0) > 0 || (funil?.aguardando_envelhecidos_48h ?? 0) > 0;

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="flex items-center gap-2">
        <Inbox className="h-4 w-4 text-primary" />
        <h2 className="text-base font-semibold text-foreground">Funil operacional</h2>
        {!funilLoading && funil && funil.ativos_total > 0 && (
          <span className="text-xs text-muted-foreground">
            {funil.ativos_total} foco{funil.ativos_total !== 1 ? 's' : ''} ativos
          </span>
        )}
      </div>

      {funilLoading ? (
        <div className="grid grid-cols-4 gap-2">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      ) : funil ? (
        <>
          {/* ── Funil: estágios atuais ── */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <KpiBox label="Em triagem" value={funil.em_triagem_agora} sub={`${funil.entradas_hoje} entrada${funil.entradas_hoje !== 1 ? 's' : ''} hoje`} />
            <KpiBox label="Aguarda inspeção" value={funil.aguarda_inspecao_agora} />
            <KpiBox label="Em inspeção" value={funil.em_inspecao_agora} />
            <KpiBox label="Resolvidos hoje" value={funil.resolvidos_hoje} sub={`${funil.resolvidos_7d} em 7 dias`} />
          </div>

          {/* ── Métricas de tempo ── */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-border bg-muted/20 px-3 py-2.5 flex items-center gap-3">
              <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
              <div>
                <p className="text-sm font-semibold text-foreground tabular-nums">
                  {horas(funil.tempo_medio_triagem_7d_horas)}
                </p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Tempo médio em triagem (7d)</p>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-muted/20 px-3 py-2.5 flex items-center gap-3">
              <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
              <div>
                <p className="text-sm font-semibold text-foreground tabular-nums">
                  {horas(funil.tempo_medio_suspeita_inspecao_7d_horas)}
                </p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Tempo suspeita → inspeção (7d)</p>
              </div>
            </div>
          </div>

          {/* ── Alertas operacionais ── */}
          {temAlerta && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/60 dark:border-amber-800/40 dark:bg-amber-950/20 px-3 py-2.5 space-y-1">
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                <p className="text-xs font-medium text-amber-800 dark:text-amber-300">Gargalos detectados</p>
              </div>
              {funil.envelhecidos_24h > 0 && (
                <p className="text-xs text-amber-700 dark:text-amber-400 pl-5">
                  {funil.envelhecidos_24h} foco{funil.envelhecidos_24h !== 1 ? 's' : ''} em triagem há mais de 24 h
                  {funil.sem_responsavel_em_triagem > 0 && ` · ${funil.sem_responsavel_em_triagem} sem agente`}
                </p>
              )}
              {funil.aguardando_envelhecidos_48h > 0 && (
                <p className="text-xs text-amber-700 dark:text-amber-400 pl-5">
                  {funil.aguardando_envelhecidos_48h} aguardando inspeção há mais de 48 h
                </p>
              )}
              {funil.foco_mais_antigo_em && (
                <p className="text-xs text-amber-700/70 dark:text-amber-500 pl-5">
                  Foco mais antigo na fila: {formatDistanceToNow(new Date(funil.foco_mais_antigo_em), { addSuffix: true, locale: ptBR })}
                </p>
              )}
            </div>
          )}

          {/* ── Entradas por origem ── */}
          {origemAtivas.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {origemAtivas.map(([origem, count]) => (
                <span key={origem} className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground">
                  <span className="font-medium text-foreground tabular-nums">{count}</span>
                  {origemLabels[origem] ?? origem}
                </span>
              ))}
              <span className="text-[11px] text-muted-foreground self-center pl-0.5">hoje por origem</span>
            </div>
          )}
        </>
      ) : null}

      {/* ── Produtividade por agente ── */}
      {agentes.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Agentes em campo</h3>
          </div>
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">Agente</th>
                  <th className="px-2 py-1.5 text-center font-medium text-muted-foreground">Ativos</th>
                  <th className="px-2 py-1.5 text-center font-medium text-muted-foreground">Iniciados hoje</th>
                  <th className="px-2 py-1.5 text-center font-medium text-muted-foreground">Resolvidos</th>
                  <th className="px-2 py-1.5 text-center font-medium text-muted-foreground hidden sm:table-cell">Envelh.</th>
                </tr>
              </thead>
              <tbody>
                {agentes.slice(0, 8).map((ag, i) => (
                  <tr key={ag.agente_id} className={`border-b border-border/50 ${i % 2 === 0 ? '' : 'bg-muted/20'}`}>
                    <td className="px-3 py-1.5 font-medium text-foreground truncate max-w-[140px]">
                      {ag.agente_nome ?? 'Sem nome'}
                    </td>
                    <td className="px-2 py-1.5 text-center tabular-nums text-foreground">{ag.atribuidos_ativos}</td>
                    <td className="px-2 py-1.5 text-center tabular-nums">
                      <span className={ag.iniciados_hoje > 0 ? 'text-emerald-600 font-medium' : 'text-muted-foreground'}>
                        {ag.iniciados_hoje}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-center tabular-nums">
                      <span className={ag.resolvidos_hoje > 0 ? 'text-emerald-600 font-medium' : 'text-muted-foreground'}>
                        {ag.resolvidos_hoje}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-center tabular-nums hidden sm:table-cell">
                      {ag.envelhecidos > 0
                        ? <span className="text-amber-600 font-medium">{ag.envelhecidos}</span>
                        : <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mx-auto" />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Despachos por supervisor ── */}
      {supervisores.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Despachos por supervisor</h3>
            <span className="text-xs text-muted-foreground">últimos 7 dias</span>
          </div>
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">Supervisor</th>
                  <th className="px-2 py-1.5 text-center font-medium text-muted-foreground">Hoje</th>
                  <th className="px-2 py-1.5 text-center font-medium text-muted-foreground">7 dias</th>
                  <th className="px-2 py-1.5 text-center font-medium text-muted-foreground hidden sm:table-cell">Total</th>
                  <th className="px-2 py-1.5 text-center font-medium text-muted-foreground hidden sm:table-cell">T. médio triagem</th>
                </tr>
              </thead>
              <tbody>
                {supervisores.slice(0, 5).map((sv, i) => (
                  <tr key={sv.supervisor_id ?? i} className={`border-b border-border/50 ${i % 2 === 0 ? '' : 'bg-muted/20'}`}>
                    <td className="px-3 py-1.5 font-medium text-foreground truncate max-w-[140px]">
                      {sv.supervisor_nome ?? 'Desconhecido'}
                    </td>
                    <td className="px-2 py-1.5 text-center tabular-nums">
                      <span className={sv.despachados_hoje > 0 ? 'text-emerald-600 font-medium' : 'text-muted-foreground'}>
                        {sv.despachados_hoje}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-center tabular-nums text-foreground font-medium">{sv.despachados_7d}</td>
                    <td className="px-2 py-1.5 text-center tabular-nums text-muted-foreground hidden sm:table-cell">{sv.despachados_total}</td>
                    <td className="px-2 py-1.5 text-center tabular-nums text-muted-foreground hidden sm:table-cell">
                      {horas(sv.tempo_medio_triagem_7d_horas)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/** Wrapper com Card para uso em CentralOperacional */
export function PainelPilotoFunilCard() {
  return (
    <Card className="rounded-xl">
      <CardContent className="pt-4 pb-4">
        <PainelPilotoFunil />
      </CardContent>
    </Card>
  );
}
