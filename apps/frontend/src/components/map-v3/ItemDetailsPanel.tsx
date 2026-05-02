import { LevantamentoItem } from "@/types/database";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { resolveMediaUrl } from "@/lib/media";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { http } from "@sentinella/api-client";
import { api } from "@/services/api";
import { useClienteAtivo } from "@/hooks/useClienteAtivo";
import { useAuth } from "@/hooks/useAuth";
import { useHistoricoAtendimentoLocal } from "@/hooks/useHistoricoAtendimentoLocal";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { 
  X, MapPin, Calendar, Clock, Image as ImageIcon,
  CheckCircle2, PlusCircle, Map as MapIcon, Navigation, Send, Loader2, UserCheck, XCircle, History, ChevronDown
} from "lucide-react";

interface Agente { id: string; nome: string; }

interface OperacaoStatus {
  id: string;
  status: string;
  responsavel_nome: string | null;
  iniciado_em: string | null;
  concluido_em: string | null;
}

/** Tailwind `lg:` — painel mobile em portal para fixed ancorar na viewport (evita offset por overflow/margem de ancestrais). */
function useIsLgBreakpoint() {
  const [isLg, setIsLg] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(min-width: 1024px)").matches : false
  );
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const fn = () => setIsLg(mq.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);
  return isLg;
}

interface Props {
  item: LevantamentoItem | null;
  onClose: () => void;
  onOpenImage: (url: string) => void;
  /** Cria tarefa de correção avulsa (pendente, sem agente). A operação pode ser atribuída depois em Operações. */
  onCreateTask?: () => Promise<void>;
  onSendFieldTeam?: (responsavelId?: string) => Promise<void>;
  onMarkResolved?: () => Promise<void>;
}

export function ItemDetailsPanel({ item, onClose, onOpenImage, onCreateTask, onSendFieldTeam, onMarkResolved }: Props) {
  const isLg = useIsLgBreakpoint();
  const { clienteId } = useClienteAtivo();
  const { isAdminOrSupervisor } = useAuth();
  const [sendingTeam, setSendingTeam] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [agentes, setAgentes] = useState<Agente[]>([]);
  const [selectedAgente, setSelectedAgente] = useState<string>('');
  const [opStatus, setOpStatus] = useState<OperacaoStatus | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const { historico, loading: historicoLoading } = useHistoricoAtendimentoLocal(
    clienteId ?? null,
    item?.latitude ?? null,
    item?.longitude ?? null
  );

  useEffect(() => {
    if (!clienteId || !isAdminOrSupervisor) return;
    http.get(`/usuarios?clienteId=${encodeURIComponent(clienteId)}&ativo=true`)
      .then((data) => setAgentes((data as Agente[]) || []))
      .catch(() => setAgentes([]));
  }, [clienteId, isAdminOrSupervisor]);

  // Fetch operation status for this item
  useEffect(() => {
    if (!item?.id || !clienteId) { setOpStatus(null); return; }
    http.get(`/operacoes?clienteId=${encodeURIComponent(clienteId)}&itemLevantamentoId=${encodeURIComponent(item.id)}&limit=1`)
      .then(async (data) => {
        const list = (data as Array<Record<string, unknown>>) ?? [];
        if (list.length === 0) { setOpStatus(null); return; }
        const op = list[0];
        const responsavelId = (op.responsavel_id ?? op.responsavelId) as string | null;
        let nome: string | null = null;
        if (responsavelId && isAdminOrSupervisor) {
          const usr = await http.get(`/usuarios/${encodeURIComponent(responsavelId)}`).catch(() => null) as Record<string, unknown> | null;
          nome = (usr?.nome as string | null) ?? null;
        }
        setOpStatus({
          id: op.id as string,
          status: op.status as string,
          responsavel_nome: nome,
          iniciado_em: (op.iniciado_em ?? op.iniciadoEm) as string | null,
          concluido_em: (op.concluido_em ?? op.concluidoEm) as string | null,
        });
      })
      .catch(() => setOpStatus(null));
  }, [item?.id, clienteId, sendingTeam, resolving, cancelling, refreshKey]);

  if (!item) return null;

  const getRiskColor = (risk: string | null) => {
    switch ((risk || '').toLowerCase()) {
      case 'critico':
      case 'alto': return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'medio': return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
      case 'baixo': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      default: return 'bg-muted text-muted-foreground border-border';
    }
  };

  const imgUrl = resolveMediaUrl(item.image_url);

  const handleSendTeam = async () => {
    if (!onSendFieldTeam) return;
    setSendingTeam(true);
    try { await onSendFieldTeam(selectedAgente || undefined); } finally { setSendingTeam(false); setSelectedAgente(''); }
  };

  const handleResolve = async () => {
    if (!onMarkResolved) return;
    setResolving(true);
    try { await onMarkResolved(); } finally { setResolving(false); }
  };

  const panelContent = (
    <>
      {/* Mobile: header moderno com safe area */}
      <div className="flex items-center justify-between gap-3 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pt-3 pb-3 lg:hidden shrink-0 bg-card border-b border-border/40 min-w-0">
        <div className="flex-1 min-w-0 flex flex-col items-center">
          <div className="w-9 h-1 rounded-full bg-muted-foreground/30 mb-2" aria-hidden />
          <span className="text-sm font-semibold text-foreground truncate w-full text-center">
            {item.item || 'Detecção'}
          </span>
        </div>
        <button
          onClick={onClose}
          className="w-11 h-11 flex items-center justify-center rounded-full bg-muted/80 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0 touch-manipulation"
          aria-label="Fechar"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Desktop close button */}
      <div className="absolute top-4 right-4 z-50 hidden lg:flex">
        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-full bg-background/80 hover:bg-muted/80 backdrop-blur-sm border border-border/40 text-muted-foreground hover:text-foreground transition-all duration-200"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden custom-scrollbar overscroll-contain">
        {imgUrl ? (
          <div className="relative w-full aspect-[4/3] max-h-56 lg:h-64 bg-muted group cursor-pointer active:opacity-95 overflow-hidden" onClick={() => onOpenImage(imgUrl)}>
            <img 
              src={imgUrl} 
              alt="Detecção" 
              className="w-full h-full object-cover transition-transform duration-300 group-active:scale-[1.02]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-80 lg:opacity-0" aria-hidden />
            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-center gap-2 rounded-xl bg-black/50 backdrop-blur-sm py-2 px-3 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
              <ImageIcon className="w-4 h-4 text-white shrink-0" />
              <span className="text-xs font-semibold text-white">Ver imagem ampliada</span>
            </div>
          </div>
        ) : (
          <div className="w-full h-36 lg:h-48 bg-muted/50 flex items-center justify-center rounded-b-2xl lg:rounded-none">
            <span className="text-sm text-muted-foreground">Sem imagem</span>
          </div>
        )}

        <div className="min-w-0 max-w-full overflow-x-hidden space-y-4 lg:space-y-6 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pt-4 pb-4 lg:p-6 lg:pb-4">
          {/* Card: Ponto e endereço — visual mobile moderno */}
          <Card className="rounded-2xl border-0 shadow-sm bg-muted/20 lg:border lg:shadow-none lg:bg-transparent lg:rounded-2xl">
            <CardContent className="p-4 lg:p-0 space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className={cn("capitalize font-semibold tracking-wide px-2.5 py-0.5 rounded-lg text-xs", getRiskColor(item.risco))}>
                  {item.risco || 'Sem classif.'}
                </Badge>
                <Badge variant="secondary" className="px-2.5 py-0.5 font-medium rounded-lg text-xs truncate max-w-[160px]">
                  {item.item || 'Item'}
                </Badge>
              </div>
              <div>
                <h2 className="text-base lg:text-xl font-bold text-foreground tracking-tight">
                  Detalhes do ponto
                </h2>
                <div className="flex items-start gap-2 text-muted-foreground mt-2 min-w-0">
                  <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-primary" />
                  <p className="text-sm leading-snug break-words min-w-0">
                    {item.endereco_completo || item.endereco_curto || 'Endereço não informado'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card: Métricas */}
          <Card className="rounded-2xl border-0 shadow-sm bg-muted/20 lg:border lg:shadow-none lg:bg-transparent lg:rounded-2xl">
            <CardContent className="p-4 lg:p-0">
          <div className="grid grid-cols-2 gap-3 p-4 lg:p-4 lg:bg-muted/30 lg:border lg:border-border/40 lg:rounded-2xl">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Score / Peso</p>
              <p className="text-sm font-semibold text-foreground">
                {item.score_final ?? item.peso ?? 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Prioridade</p>
              <p className="text-sm font-semibold text-foreground capitalize">
                {item.prioridade || 'Normal'}
              </p>
            </div>
            <div className="col-span-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Data da ocorrência</p>
              <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-primary" />
                {item.data_hora ? new Date(item.data_hora).toLocaleString('pt-BR') : new Date(item.created_at).toLocaleString('pt-BR')}
              </p>
            </div>
            <div className="col-span-2 border-t border-border/50 pt-3 mt-1">
               <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">SLA Estimado</p>
               <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-primary" />
                  {item.sla_horas ? `${item.sla_horas} horas corridas` : 'Indefinido / Sem SLA'}
               </p>
            </div>
          </div>
            </CardContent>
          </Card>

          {/* Status da operação — card moderno */}
          {opStatus && (
            <div className={cn(
              "rounded-2xl border p-4 space-y-2 shadow-sm",
              opStatus.status === 'concluido' && "bg-emerald-500/10 border-emerald-500/20",
              opStatus.status === 'em_andamento' && "bg-blue-500/10 border-blue-500/20",
              opStatus.status !== 'concluido' && opStatus.status !== 'em_andamento' && "bg-muted/20 border-border/40"
            )}>
              <div className="flex items-center gap-2">
                {opStatus.status === 'concluido' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                ) : opStatus.status === 'em_andamento' ? (
                  <Send className="w-4 h-4 text-blue-500" />
                ) : (
                  <Clock className="w-4 h-4 text-muted-foreground" />
                )}
                <span className="text-sm font-bold text-foreground">
                  {opStatus.status === 'concluido' ? 'Resolvido' : opStatus.status === 'em_andamento' ? 'Equipe enviada' : 'Pendente'}
                </span>
              </div>
              {opStatus.responsavel_nome && (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <UserCheck className="w-3 h-3" />
                  Responsável: <span className="font-semibold text-foreground">{opStatus.responsavel_nome}</span>
                </p>
              )}
              {opStatus.status === 'concluido' && opStatus.concluido_em && (
                <p className="text-xs text-muted-foreground">
                  Concluído em {new Date(opStatus.concluido_em).toLocaleString('pt-BR')}
                </p>
              )}
              {opStatus.status === 'em_andamento' && opStatus.iniciado_em && (
                <p className="text-xs text-muted-foreground">
                  Iniciado em {new Date(opStatus.iniciado_em).toLocaleString('pt-BR')}
                </p>
              )}
              {opStatus.status === 'em_andamento' && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 mt-1 w-full text-xs font-semibold text-destructive hover:bg-destructive/10 border border-destructive/20 rounded-lg"
                      disabled={cancelling}
                    >
                      {cancelling ? <Loader2 className="w-3 h-3 mr-1.5 animate-spin" /> : <XCircle className="w-3 h-3 mr-1.5" />}
                      Cancelar operação
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Cancelar operação?</AlertDialogTitle>
                      <AlertDialogDescription>
                        A operação em andamento para <strong>{item.item || 'este ponto'}</strong> será cancelada. Esta ação não pode ser desfeita.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Voltar</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                        onClick={async () => {
                          setCancelling(true);
                          try {
                            await api.operacoes.cancelar(opStatus.id);
                            const { toast } = await import('sonner');
                            toast.success('Operação cancelada');
                            setOpStatus(null);
                            setRefreshKey(k => k + 1);
                          } finally { setCancelling(false); }
                        }}
                      >
                        Confirmar cancelamento
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          )}

          {/* Histórico neste local */}
          {item.latitude != null && item.longitude != null && (
            <Card className="overflow-hidden rounded-2xl border-0 shadow-sm bg-muted/20 lg:border lg:shadow-none lg:bg-transparent lg:rounded-xl">
            <Collapsible defaultOpen={historico.length > 0} className="rounded-2xl lg:rounded-xl border-0 lg:border border-border/40 overflow-hidden">
              <CollapsibleTrigger className="flex w-full items-center justify-between p-3 text-left hover:bg-muted/40 transition-colors">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <History className="h-3.5 w-3.5" />
                  Histórico neste local
                  {historico.length > 0 && (
                    <Badge variant="secondary" className="text-[10px] font-bold">{historico.length}</Badge>
                  )}
                </span>
                {historicoLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 data-[state=open]:rotate-180 transition-transform" />
                )}
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="border-t border-border/40 p-3 max-h-48 overflow-y-auto space-y-2">
                  {historico.length === 0 && !historicoLoading && (
                    <p className="text-xs text-muted-foreground">Nenhuma ocorrência anterior neste ponto.</p>
                  )}
                  {historico.map((row) => (
                    <div
                      key={`${row.levantamento_item_id}-${row.operacao_id ?? row.item_created_at}`}
                      className="text-xs rounded-lg p-2 bg-background/60 border border-border/30"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-semibold text-foreground truncate">{row.item || '—'}</span>
                        {row.operacao_status && (
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-[9px] shrink-0',
                              row.operacao_status === 'concluido' && 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
                              row.operacao_status === 'em_andamento' && 'bg-blue-500/10 text-blue-600 border-blue-500/30'
                            )}
                          >
                            {row.operacao_status === 'concluido' ? 'Concluído' : row.operacao_status === 'em_andamento' ? 'Em andamento' : row.operacao_status}
                          </Badge>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {row.item_data_hora
                          ? new Date(row.item_data_hora).toLocaleString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                          : new Date(row.item_created_at).toLocaleString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                        {row.responsavel_nome && ` · ${row.responsavel_nome}`}
                      </p>
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
            </Card>
          )}
        </div>
      </div>

      {/* Rodapé de ações — mobile first com safe area */}
      <div className="pt-3 pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] pb-[max(1rem,env(safe-area-inset-bottom))] lg:p-4 lg:pb-5 border-t border-border/40 bg-background/95 backdrop-blur-sm space-y-2.5 shrink-0 min-w-0 max-w-full overflow-x-hidden">
        <Button
          className="w-full max-w-full bg-primary text-primary-foreground font-semibold rounded-2xl min-h-12 h-auto py-3 px-3 hover:bg-primary/90 text-sm shadow-lg shadow-primary/20 active:scale-[0.98] transition-transform whitespace-normal text-center leading-snug inline-flex flex-wrap items-center justify-center gap-2"
          onClick={async () => {
            await onCreateTask?.();
            setRefreshKey((k) => k + 1);
          }}
          disabled={!onCreateTask}
        >
          <PlusCircle className="w-5 h-5 shrink-0" />
          Criar tarefa de correção
        </Button>
        <div className="grid grid-cols-2 gap-2 min-w-0 w-full">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                className="w-full min-w-0 max-w-full font-semibold rounded-2xl text-xs h-11 border-primary/30 text-primary hover:bg-primary/10 active:scale-[0.98]"
                disabled={sendingTeam}
              >
                {sendingTeam ? <Loader2 className="w-3.5 h-3.5 mr-1.5 shrink-0 animate-spin" /> : <Send className="w-3.5 h-3.5 mr-1.5 shrink-0" />}
                <span className="truncate">Equipe</span>
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Enviar equipe de campo?</AlertDialogTitle>
                <AlertDialogDescription>
                  Uma operação será criada para o ponto <strong>{item.item || 'selecionado'}</strong>.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="py-2">
                <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">
                  <UserCheck className="w-3.5 h-3.5 inline mr-1.5" />
                  Agente responsável
                </Label>
                <Select value={selectedAgente} onValueChange={setSelectedAgente}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Selecionar agente (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {agentes.map(op => (
                      <SelectItem key={op.id} value={op.id}>{op.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setSelectedAgente('')}>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleSendTeam}>Confirmar envio</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                className="w-full min-w-0 max-w-full font-semibold rounded-2xl text-xs h-11 border-emerald-500/30 text-emerald-600 dark:text-emerald-500 hover:bg-emerald-500/10 active:scale-[0.98]"
                disabled={resolving}
              >
                {resolving ? <Loader2 className="w-3.5 h-3.5 mr-1.5 shrink-0 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 shrink-0" />}
                <span className="truncate">Resolvido</span>
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Marcar como resolvido?</AlertDialogTitle>
                <AlertDialogDescription>
                  O item <strong>{item.item || 'selecionado'}</strong> será marcado como concluído. Esta ação pode ser revertida na tela de Operações.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleResolve} className="bg-emerald-600 hover:bg-emerald-700">Confirmar</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
        <div className="grid grid-cols-2 gap-2 min-w-0 w-full">
          {item.maps ? (
             <Button variant="outline" size="sm" className="w-full min-w-0 max-w-full font-semibold rounded-2xl text-xs h-11 border-border/60 hover:bg-muted/40 active:scale-[0.98]" onClick={() => window.open(item.maps!, "_blank")}>
               <MapIcon className="w-4 h-4 mr-1.5 shrink-0 text-blue-500" /> <span className="truncate">Maps</span>
             </Button>
          ) : (
             <Button variant="outline" size="sm" disabled className="w-full min-w-0 max-w-full font-semibold rounded-2xl text-xs h-11 border-border/60">
               <MapIcon className="w-4 h-4 mr-1.5 shrink-0 opacity-50" /> <span className="truncate">Maps</span>
             </Button>
          )}

          {item.waze ? (
             <Button variant="outline" size="sm" className="w-full min-w-0 max-w-full font-semibold rounded-2xl text-xs h-11 border-border/60 hover:bg-muted/40 active:scale-[0.98]" onClick={() => window.open(item.waze!, "_blank")}>
               <Navigation className="w-4 h-4 mr-1.5 shrink-0 text-teal-500" /> <span className="truncate">Waze</span>
             </Button>
          ) : (
            <Button variant="outline" size="sm" disabled className="w-full min-w-0 max-w-full font-semibold rounded-2xl text-xs h-11 border-border/60">
              <Navigation className="w-4 h-4 mr-1.5 shrink-0 opacity-50" /> <span className="truncate">Waze</span>
            </Button>
          )}
        </div>
      </div>
    </>
  );

  return (
    <>
      {!isLg &&
        typeof document !== "undefined" &&
        createPortal(
          <>
            <div
              className="fixed inset-x-0 top-0 bottom-32 z-[499] max-w-[100vw] overflow-x-hidden bg-black/40"
              onClick={onClose}
            />
            <div
              className={cn(
                "bg-card z-[500] flex flex-col shrink-0 relative overflow-hidden",
                "fixed left-0 right-0 bottom-32 w-full min-w-0 max-w-[100vw] box-border overflow-x-hidden",
                "max-h-[calc(100dvh-8rem-env(safe-area-inset-bottom,0px))]",
                "rounded-t-3xl shadow-2xl border-t border-border/40"
              )}
            >
              {panelContent}
            </div>
          </>,
          document.body
        )}
      {isLg && (
        <div
          className={cn(
            "bg-card z-[500] flex flex-col shrink-0 relative overflow-hidden",
            "lg:static lg:w-[380px] lg:h-full lg:max-h-none lg:border-l lg:rounded-none lg:shadow-xl lg:border-t-0 lg:overflow-x-visible animate-slide-in-left"
          )}
        >
          {panelContent}
        </div>
      )}
    </>
  );
}
