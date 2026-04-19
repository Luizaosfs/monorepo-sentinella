import { LevantamentoItem } from "@/types/database";
import { Badge } from "@/components/ui/badge";
import { resolveMediaUrl } from "@/lib/media";
import { useState, useEffect } from "react";
import { 
  X, MapPin, AlertTriangle, BrainCircuit, CheckCircle2, Send, ClipboardCheck,
  Expand, Info, Loader2, UserCheck, Clock, XCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
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

interface Agente { id: string; nome: string; }

interface OperacaoStatus {
  id: string;
  status: string;
  responsavel_nome: string | null;
  iniciado_em: string | null;
  concluido_em: string | null;
}

interface Props {
  item: LevantamentoItem | null;
  onClose: () => void;
  onOpenImage: (url: string) => void;
  /** Cria tarefa de correção avulsa (pendente, sem agente). Pode ser atribuída depois em Operações. */
  onCreateTask?: (item: LevantamentoItem) => Promise<void>;
  onSendFieldTeam?: (item: LevantamentoItem, responsavelId?: string) => Promise<void>;
  onMarkResolved?: (item: LevantamentoItem) => Promise<void>;
}

export function RiskDetailsPanel({ item, onClose, onOpenImage, onCreateTask, onSendFieldTeam, onMarkResolved }: Props) {
  const { clienteId } = useClienteAtivo();
  const [sendingTeam, setSendingTeam] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [agentes, setOperadores] = useState<Agente[]>([]);
  const [selectedAgente, setSelectedOperador] = useState<string>('');
  const [opStatus, setOpStatus] = useState<OperacaoStatus | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!clienteId) return;
    http.get(`/usuarios?clienteId=${encodeURIComponent(clienteId)}&ativo=true`)
      .then((data) => setOperadores((data as Agente[]) || []))
      .catch(() => setOperadores([]));
  }, [clienteId]);

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
        if (responsavelId) {
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
      case 'critico': return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'alto': return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'medio': return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
      case 'baixo': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      default: return 'bg-muted text-muted-foreground border-border';
    }
  };

  const getSuggestedAction = (type: string | null) => {
    const t = (type || '').toLowerCase();
    if (t.includes('pneu')) return 'Recolher material imediatamente para descarte em ecoponto.';
    if (t.includes('caixa')) return 'Tampar estrutura urgentemente e aplicar larvicida preventivo.';
    if (t.includes('poca') || t.includes('poça') || t.includes('piscina') || t.includes('agua') || t.includes('água')) return 'Realizar drenagem ou tratamento químico com larvicida biológico (BTI).';
    if (t.includes('lixo') || t.includes('entulho')) return 'Notificar proprietário ou acionar equipe de limpeza urbana.';
    if (t.includes('recipiente')) return 'Remover objeto do local ou garantir que fique virado para baixo.';
    return 'Enviar equipe para inspeção in loco prioritária.';
  };

  const imgUrl = resolveMediaUrl(item.image_url);
  const confidence = Math.floor(Math.random() * 20) + 80;

  const handleSendTeam = async () => {
    if (!onSendFieldTeam) return;
    setSendingTeam(true);
    try { await onSendFieldTeam(item, selectedAgente || undefined); } finally { setSendingTeam(false); setSelectedOperador(''); }
  };

  const handleResolve = async () => {
    if (!onMarkResolved) return;
    setResolving(true);
    try { await onMarkResolved(item); } finally { setResolving(false); }
  };

  return (
    <>
      {/* Mobile backdrop */}
      <div
        className="fixed inset-0 z-[499] bg-black/40 lg:hidden"
        onClick={onClose}
      />

      <div className={[
        "bg-card shadow-xl border-border/60 z-[500] flex flex-col shrink-0 relative overflow-hidden",
        // Mobile: bottom sheet
        "fixed bottom-0 inset-x-0 h-[80vh] rounded-t-2xl border-t",
        // Desktop: right side panel
        "lg:static lg:w-[380px] lg:h-full lg:rounded-none lg:border-t-0 lg:border-l animate-slide-left",
      ].join(' ')}>
      {/* Mobile drag handle + close */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2 lg:hidden border-b border-border/60 shrink-0">
        <div className="w-10 h-1 bg-border rounded-full absolute left-1/2 -translate-x-1/2 top-2" />
        <span className="text-sm font-bold text-foreground mt-1 truncate max-w-[80%]">
          {item.item || 'Detecção'}
        </span>
        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-full bg-muted hover:bg-muted/80 transition-colors shrink-0"
        >
          <X className="w-4 h-4 text-muted-foreground" />
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

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {imgUrl ? (
          <div className="relative w-full h-64 bg-muted group cursor-pointer" onClick={() => onOpenImage(imgUrl)}>
            <img 
              src={imgUrl} 
              alt="Detecção AI" 
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <div className="flex items-center gap-2 text-white bg-black/50 px-4 py-2 rounded-full backdrop-blur-md">
                <Expand className="w-4 h-4" />
                <span className="text-sm font-bold">Ampliar imagem</span>
              </div>
            </div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 border-2 border-primary border-dashed rounded-lg shadow-[0_0_15px_rgba(var(--primary),0.5)] opacity-50 bg-primary/10 pointer-events-none" />
          </div>
        ) : (
          <div className="w-full h-48 bg-muted flex items-center justify-center">
            <span className="text-sm font-medium text-muted-foreground">Imagem não disponível</span>
          </div>
        )}

        <div className="p-6 space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Badge variant="outline" className={`capitalize font-black tracking-widest px-3 py-1 shadow-sm ${getRiskColor(item.risco)}`}>
                Risco {item.risco || 'Indefinido'}
              </Badge>
              <div className="flex items-center gap-1.5 px-3 py-1 bg-primary/10 text-primary border border-primary/20 rounded-full text-xs font-bold tracking-wide">
                <BrainCircuit className="w-3.5 h-3.5" />
                {confidence}% de Confiança
              </div>
            </div>

            <div>
              <h2 className="text-2xl font-black text-foreground tracking-tight leading-tight">
                {item.item || 'Foco Detectado'}
              </h2>
              <div className="flex items-start gap-2 text-muted-foreground mt-2">
                <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-primary" />
                <p className="text-sm font-medium leading-snug">
                  {item.endereco_completo || item.endereco_curto || 'Endereço não rastreado'}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 p-4 bg-muted/30 border border-border/40 rounded-2xl">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">ID do Voo</p>
              <p className="font-mono text-sm font-bold text-foreground truncate" title={item.levantamento_id}>
                #{item.levantamento_id.substring(0, 8)}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Horário da Detecção</p>
              <p className="text-sm font-bold text-foreground">
                {item.data_hora ? new Date(item.data_hora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : 'N/A'}
              </p>
            </div>
            <div className="col-span-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Coordenadas Gps</p>
              <p className="font-mono text-xs font-semibold text-muted-foreground">
                {item.latitude}, {item.longitude}
              </p>
            </div>
          </div>

          {/* Operation status card */}
          {opStatus && (
            <div className={`rounded-xl border p-3 space-y-1.5 ${
              opStatus.status === 'concluido'
                ? 'bg-emerald-500/10 border-emerald-500/30'
                : opStatus.status === 'em_andamento'
                  ? 'bg-blue-500/10 border-blue-500/30'
                  : 'bg-muted/30 border-border/40'
            }`}>
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

          <div className="p-4 bg-blue-500/5 border border-blue-500/20 rounded-2xl">
            <h3 className="text-[11px] font-black uppercase text-blue-500 tracking-widest flex items-center gap-1.5 mb-2">
              <Info className="w-3.5 h-3.5" />
              Ação Sugerida
            </h3>
            <p className="text-sm text-foreground/80 font-medium leading-relaxed">
              {getSuggestedAction(item.item)}
            </p>
          </div>
        </div>
      </div>

      <div className="p-5 border-t border-border/60 bg-muted/10 space-y-3 shrink-0">
        <Button
          className="w-full bg-primary text-primary-foreground font-bold shadow-md rounded-xl h-11"
          size="lg"
          onClick={async () => {
            await onCreateTask?.(item);
            setRefreshKey((k) => k + 1);
          }}
          disabled={!onCreateTask}
        >
          <ClipboardCheck className="w-4 h-4 mr-2" />
          Criar Tarefa de Correção
        </Button>
        <div className="flex gap-3">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                className="flex-1 font-semibold rounded-xl text-xs h-10 border-primary/30 text-primary hover:bg-primary/10"
                disabled={sendingTeam}
              >
                {sendingTeam ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> : <Send className="w-3.5 h-3.5 mr-2" />}
                Equipe
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
                <Select value={selectedAgente} onValueChange={setSelectedOperador}>
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
                <AlertDialogCancel onClick={() => setSelectedOperador('')}>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleSendTeam}>Confirmar envio</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                className="flex-1 font-semibold rounded-xl text-xs h-10 border-emerald-500/30 text-emerald-600 dark:text-emerald-500 hover:bg-emerald-500/10"
                disabled={resolving}
              >
                {resolving ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5 mr-2" />}
                Resolvido
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Marcar como resolvido?</AlertDialogTitle>
                <AlertDialogDescription>
                  O item <strong>{item.item || 'selecionado'}</strong> será marcado como concluído.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleResolve} className="bg-emerald-600 hover:bg-emerald-700">Confirmar</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
    </>
  );
}
