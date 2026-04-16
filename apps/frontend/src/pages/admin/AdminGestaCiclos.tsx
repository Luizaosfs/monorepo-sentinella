import { useState } from 'react';
import {
  Calendar, CheckCircle2, RotateCcw, Copy,
  ChevronDown, ChevronUp, TrendingUp,
  Users, AlertTriangle, ClipboardList,
} from 'lucide-react';
import { toast } from 'sonner';
import { format, isValid, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/** Evita 31/12/1969 (epoch visto como data local) quando o valor vem null do backend. */
function formatDataCiclo(d: string | null | undefined): string {
  if (d == null || d === '') return '—';
  const parsed = parseISO(d.length === 10 ? `${d}T12:00:00` : d);
  return isValid(parsed) ? format(parsed, 'dd/MM/yyyy', { locale: ptBR }) : '—';
}
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import AdminPageHeader from '@/components/AdminPageHeader';
import {
  useCicloAtivo, useCicloProgresso, useHistoricoCiclos,
  useAbrirCiclo, useFecharCiclo, useCopiarDistribuicao,
  CICLO_LABELS, CICLO_STATUS_COR, CICLO_STATUS_LABEL,
  type Ciclo, type CicloSnapshot,
} from '@/hooks/queries/useCicloAtivo';
import { getCurrentCiclo } from '@/lib/ciclo';
import { cn } from '@/lib/utils';

// ── Seção: KPIs de progresso ─────────────────────────────────────────────────
function ProgressoKpis() {
  const { data: prog, isLoading } = useCicloProgresso();

  if (isLoading) return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-24 rounded-2xl" />
      ))}
    </div>
  );
  if (!prog) return null;

  return (
    <div className="space-y-4">
      {/* Barra de cobertura */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-sm">
          <span className="font-medium">Cobertura do ciclo</span>
          <span className="text-muted-foreground">
            {prog.imoveis_visitados} / {prog.imoveis_total} imóveis
            {' '}({prog.cobertura_pct ?? 0}%)
          </span>
        </div>
        <Progress value={prog.cobertura_pct ?? 0} className="h-3" />
      </div>

      {/* Grid de KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Vistorias', valor: prog.vistorias_total, icon: ClipboardList, cor: 'text-primary' },
          { label: 'Agentes ativos', valor: prog.agentes_ativos, icon: Users, cor: 'text-primary' },
          { label: 'Focos ativos', valor: prog.focos_ativos, icon: AlertTriangle, cor: 'text-orange-500' },
          { label: 'Focos resolvidos', valor: prog.focos_resolvidos, icon: CheckCircle2, cor: 'text-emerald-500' },
        ].map(({ label, valor, icon: Icon, cor }) => (
          <Card key={label} className="rounded-2xl">
            <CardContent className="p-4">
              <div className="flex justify-between items-start mb-2">
                <span className="text-xs font-bold uppercase text-muted-foreground">{label}</span>
                <Icon className={cn('h-4 w-4', cor)} />
              </div>
              <p className="text-2xl font-black">{valor}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Alertas de retorno */}
      {prog.alertas_retorno_pendentes > 0 && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200">
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
          <p className="text-sm text-amber-700">
            <strong>{prog.alertas_retorno_pendentes}</strong> alerta{prog.alertas_retorno_pendentes > 1 ? 's' : ''} de retorno pendente{prog.alertas_retorno_pendentes > 1 ? 's' : ''}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Seção: snapshot de ciclo fechado ─────────────────────────────────────────
function SnapshotCard({ snap }: { snap: CicloSnapshot }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-3">
      {[
        { label: 'Cobertura', valor: `${snap.cobertura_pct}%` },
        { label: 'Vistorias', valor: snap.total_vistorias },
        { label: 'Focos totais', valor: snap.total_focos },
        { label: 'Focos resolvidos', valor: snap.focos_resolvidos },
        { label: 'Taxa resolução', valor: `${snap.taxa_resolucao_pct}%` },
        { label: 'IIP', valor: snap.liraa?.iip !== undefined ? `${snap.liraa.iip}%` : 'N/D' },
      ].map(({ label, valor }) => (
        <div key={label} className="text-center p-3 rounded-xl bg-muted/30">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-lg font-black">{valor}</p>
        </div>
      ))}
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function AdminGestaCiclos() {
  const { data: cicloAtivoRow, cicloNumero } = useCicloAtivo();
  /** View v_ciclo_ativo sempre retorna 1 linha; sem ciclo formal, c.id e datas são null. */
  const cicloFormal = cicloAtivoRow?.id != null ? cicloAtivoRow : null;
  const { data: historico = [], isLoading: loadingHistorico } = useHistoricoCiclos();
  const abrirMutation = useAbrirCiclo();
  const fecharMutation = useFecharCiclo();
  const copiarMutation = useCopiarDistribuicao();

  // Estado do formulário de abertura
  const proximoCiclo = cicloFormal
    ? (cicloFormal.numero % 6) + 1
    : getCurrentCiclo();
  const [novoNumero, setNovoNumero] = useState(proximoCiclo);
  const [novaMeta, setNovaMeta] = useState(100);
  const [novaObs, setNovaObs] = useState('');

  // Estado de fechamento
  const [confirmFechamento, setConfirmFechamento] = useState(false);
  const [obsFechar, setObsFechar] = useState('');

  // Histórico accordion
  const [cicloExpandido, setCicloExpandido] = useState<string | null>(null);

  async function handleAbrir() {
    try {
      await abrirMutation.mutateAsync({
        numero: novoNumero,
        meta_cobertura_pct: novaMeta,
        observacao: novaObs || undefined,
      });
      toast.success(`${CICLO_LABELS[novoNumero]} aberto com sucesso`);
      setNovaObs('');
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function handleFechar() {
    if (!cicloFormal) return;
    try {
      await fecharMutation.mutateAsync({
        numero: cicloFormal.numero,
        observacao: obsFechar || undefined,
      });
      toast.success(`${CICLO_LABELS[cicloFormal.numero]} fechado. Snapshot gerado.`);
      setConfirmFechamento(false);
      setObsFechar('');
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function handleCopiarDistribuicao() {
    if (!cicloFormal) return;
    const origem = cicloFormal.numero;
    const destino = (origem % 6) + 1;
    try {
      const copiados = await copiarMutation.mutateAsync({ origem, destino });
      toast.success(`${copiados} quarteirão(ões) copiado(s) do Ciclo ${origem} para o Ciclo ${destino}`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="flex flex-col gap-6 pb-10">
      <AdminPageHeader
        title="Gestão de Ciclos"
        description="Controle formal dos ciclos epidemiológicos bimestrais"
      />

      {/* ── Ciclo ativo ── */}
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            Ciclo atual
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {cicloFormal ? (
            <>
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <p className="text-xl font-black">{CICLO_LABELS[cicloFormal.numero]}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDataCiclo(cicloFormal.data_inicio)}
                    {' → '}
                    {formatDataCiclo(cicloFormal.data_fim_prevista)}
                    {cicloFormal.pct_tempo_decorrido !== null &&
                      ` · ${cicloFormal.pct_tempo_decorrido}% do tempo decorrido`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={cn('border text-xs', CICLO_STATUS_COR[cicloFormal.status])}>
                    {CICLO_STATUS_LABEL[cicloFormal.status]}
                  </Badge>
                  {cicloFormal.status === 'ativo' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setConfirmFechamento(true)}
                    >
                      Fechar ciclo
                    </Button>
                  )}
                </div>
              </div>

              <ProgressoKpis />

              {/* Copiar distribuição */}
              <Separator />
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <p className="text-sm font-medium">Copiar distribuição de quarteirões</p>
                  <p className="text-xs text-muted-foreground">
                    Copia as atribuições do {CICLO_LABELS[cicloFormal.numero]} para o
                    {' '}{CICLO_LABELS[(cicloFormal.numero % 6) + 1]}
                  </p>
                </div>
                <Button
                  variant="outline" size="sm"
                  onClick={handleCopiarDistribuicao}
                  disabled={copiarMutation.isPending}
                >
                  <Copy className="h-3.5 w-3.5 mr-1.5" />
                  {copiarMutation.isPending ? 'Copiando...' : 'Copiar para próximo ciclo'}
                </Button>
              </div>
            </>
          ) : (
            <div className="text-center py-6 text-muted-foreground">
              <p className="text-sm">Nenhum ciclo formal ativo.</p>
              <p className="text-xs mt-1">
                O sistema usa automaticamente o {CICLO_LABELS[cicloNumero]} pelo calendário.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Abrir novo ciclo ── */}
      {!cicloFormal && (
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Abrir ciclo formal
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Ciclo bimestral</Label>
                <Select
                  value={String(novoNumero)}
                  onValueChange={v => setNovoNumero(Number(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1,2,3,4,5,6].map(n => (
                      <SelectItem key={n} value={String(n)}>
                        {CICLO_LABELS[n]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Meta de cobertura: {novaMeta}%</Label>
                <Slider
                  min={50} max={100} step={5}
                  value={[novaMeta]}
                  onValueChange={([v]) => setNovaMeta(v)}
                  className="mt-2"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Observação de abertura (opcional)</Label>
              <Textarea
                value={novaObs}
                onChange={e => setNovaObs(e.target.value)}
                placeholder="Ex: Ciclo iniciado após período de chuvas — priorizar bairros C e D..."
                rows={2}
              />
            </div>

            <Button onClick={handleAbrir} disabled={abrirMutation.isPending}>
              {abrirMutation.isPending ? 'Abrindo...' : `Abrir ${CICLO_LABELS[novoNumero]}`}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Histórico de ciclos ── */}
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <RotateCcw className="h-4 w-4 text-primary" />
            Histórico de ciclos
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingHistorico ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-xl" />
              ))}
            </div>
          ) : historico.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nenhum ciclo registrado ainda.
            </p>
          ) : (
            <div className="space-y-2">
              {historico.map((ciclo: Ciclo) => (
                <div key={ciclo.id} className="border rounded-xl overflow-hidden">
                  <button
                    className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/30 transition-colors"
                    onClick={() => setCicloExpandido(
                      cicloExpandido === ciclo.id ? null : ciclo.id
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-sm">{CICLO_LABELS[ciclo.numero]}</span>
                      <span className="text-xs text-muted-foreground">{ciclo.ano}</span>
                      <Badge className={cn('border text-xs', CICLO_STATUS_COR[ciclo.status])}>
                        {CICLO_STATUS_LABEL[ciclo.status]}
                      </Badge>
                    </div>
                    {cicloExpandido === ciclo.id
                      ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </button>

                  {cicloExpandido === ciclo.id && (
                    <div className="px-4 pb-4 border-t bg-muted/20">
                      <div className="grid grid-cols-2 gap-4 mt-3 text-sm">
                        <div>
                          <span className="text-muted-foreground">Início:</span>{' '}
                          {formatDataCiclo(ciclo.data_inicio)}
                        </div>
                        <div>
                          <span className="text-muted-foreground">Fim previsto:</span>{' '}
                          {formatDataCiclo(ciclo.data_fim_prevista)}
                        </div>
                        {ciclo.data_fechamento && (
                          <div>
                            <span className="text-muted-foreground">Fechado em:</span>{' '}
                            {formatDataCiclo(ciclo.data_fechamento)}
                          </div>
                        )}
                        <div>
                          <span className="text-muted-foreground">Meta cobertura:</span>{' '}
                          {ciclo.meta_cobertura_pct}%
                        </div>
                      </div>

                      {ciclo.observacao_abertura && (
                        <p className="mt-3 text-sm text-muted-foreground italic">
                          Abertura: {ciclo.observacao_abertura}
                        </p>
                      )}
                      {ciclo.observacao_fechamento && (
                        <p className="mt-1 text-sm text-muted-foreground italic">
                          Fechamento: {ciclo.observacao_fechamento}
                        </p>
                      )}

                      {ciclo.snapshot_fechamento && (
                        <>
                          <p className="mt-4 text-xs font-bold uppercase text-muted-foreground">
                            Indicadores ao fechar
                          </p>
                          <SnapshotCard snap={ciclo.snapshot_fechamento} />
                        </>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Dialog confirmação fechamento ── */}
      <AlertDialog open={confirmFechamento} onOpenChange={setConfirmFechamento}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Fechar {cicloFormal && CICLO_LABELS[cicloFormal.numero]}?</AlertDialogTitle>
            <AlertDialogDescription>
              Um snapshot de todos os indicadores será gerado (LIRAa, cobertura, focos, SLA).
              Esta ação não pode ser desfeita. Vistorias posteriores serão registradas no próximo ciclo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            value={obsFechar}
            onChange={e => setObsFechar(e.target.value)}
            placeholder="Observação de fechamento (opcional)..."
            rows={2}
            className="mt-2"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleFechar} disabled={fecharMutation.isPending}>
              {fecharMutation.isPending ? 'Fechando...' : 'Fechar ciclo'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
