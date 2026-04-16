import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MapPin, User, Hash, Radio, MessageSquare, CloudRain, Edit2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { FocoRiscoAtivo } from '@/types/database';
import { labelResponsavelFoco, type UsuarioLabelFields } from '@/lib/usuarioLabel';
import { LABEL_STATUS } from '@/types/focoRisco';
import { getTransicoesPermitidas } from '@/lib/transicoesFoco';
import { StatusBadge } from './StatusBadge';
import { PrioridadeBadge } from './PrioridadeBadge';
import { SlaBadge } from './SlaBadge';
import { RecorrenciaBadge } from './RecorrenciaBadge';
import { OrigemIcone } from './OrigemIcone';
import { ScoreBadge } from './ScoreBadge';
import { useScoreImovel } from '@/hooks/queries/useScoreTerritorial';

interface Props {
  foco: FocoRiscoAtivo;
  onAbrirDetalhe?: () => void;
  onVerNoMapa?: () => void;
  onTransicionar?: (foco: FocoRiscoAtivo, statusNovo: string) => void;
  compact?: boolean;
  /** Mapa `usuarios.id` → nome/e-mail (ex.: `listByCliente`) para exibir responsável como “nome · e-mail”. */
  usuarioPorId?: Map<string, UsuarioLabelFields>;
}

export function FocoRiscoCard({
  foco,
  onAbrirDetalhe,
  onVerNoMapa,
  onTransicionar,
  compact = false,
  usuarioPorId,
}: Props) {
  const transicoes = getTransicoesPermitidas(foco.status);
  const { data: score } = useScoreImovel(foco.imovel_id ?? undefined);

  const endereco = [foco.logradouro, foco.bairro].filter(Boolean).join(', ') || foco.endereco_normalizado || '';

  const responsavelText = usuarioPorId
    ? (labelResponsavelFoco(foco, usuarioPorId) ?? 'Sem responsável')
    : (foco.responsavel_nome ?? 'Sem responsável');

  let suspeitaRelativa: string | null = null;
  if (foco.suspeita_em) {
    try {
      suspeitaRelativa = formatDistanceToNow(new Date(foco.suspeita_em), { locale: ptBR, addSuffix: true });
    } catch {
      suspeitaRelativa = null;
    }
  }

  return (
    <Card className="rounded-xl border border-border/60 shadow-sm bg-card overflow-hidden">
      <CardContent className="p-4 space-y-3">
        {/* Row 1: badges */}
        <div className="flex flex-wrap gap-1.5 items-center">
          <StatusBadge status={foco.status} />
          <PrioridadeBadge prioridade={foco.prioridade} />
          <SlaBadge slaStatus={foco.sla_status} prazoEm={foco.sla_prazo_em} />
          <RecorrenciaBadge focoAnteriorId={foco.foco_anterior_id} />
          {(() => {
            const cfg: Record<string, { label: string; icon: React.ElementType; cls: string }> = {
              cidadao: { label: 'Cidadão', icon: MessageSquare, cls: 'bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-800' },
              drone:   { label: 'Drone',   icon: Radio,         cls: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800' },
              agente:  { label: 'Agente',  icon: User,          cls: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800' },
              pluvio:  { label: 'Pluvial', icon: CloudRain,     cls: 'bg-cyan-100 text-cyan-700 border-cyan-200 dark:bg-cyan-900/30 dark:text-cyan-300 dark:border-cyan-800' },
              manual:  { label: 'Manual',  icon: Edit2,         cls: 'bg-muted text-muted-foreground border-border' },
            };
            const c = cfg[foco.origem_tipo];
            if (!c) return null;
            const Icon = c.icon;
            return (
              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-semibold ${c.cls}`}>
                <Icon className="w-3 h-3" />{c.label}
              </span>
            );
          })()}
        </div>

        {/* Row 2: endereço + origem */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-1.5 min-w-0">
            <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
            <div className="min-w-0">
              {foco.codigo_foco && (
                <div className="flex items-center gap-1 mb-0.5">
                  <Hash className="w-3 h-3 text-muted-foreground/60 shrink-0" />
                  <span className="text-[11px] font-mono text-muted-foreground tracking-wide">{foco.codigo_foco}</span>
                </div>
              )}
              <span className="text-sm font-medium text-foreground truncate block">{endereco || 'Endereço não informado'}</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {score && <ScoreBadge score={score.score} classificacao={score.classificacao} size="sm" showScore={false} />}
            <OrigemIcone origem={foco.origem_tipo} className="shrink-0" />
          </div>
        </div>

        {/* Row 3 (expanded): responsável + data */}
        {!compact && (
          <div className="flex items-center justify-between text-xs text-muted-foreground gap-2">
            <div className="flex items-center gap-1 min-w-0">
              <User className="w-3 h-3 shrink-0" />
              <span className="truncate">{responsavelText}</span>
            </div>
            {suspeitaRelativa && <span>{suspeitaRelativa}</span>}
          </div>
        )}

        {/* Ações */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {transicoes.map((t) => (
            <Button
              key={t}
              size="sm"
              variant="outline"
              className="h-7 px-2 text-[11px] font-semibold"
              onClick={() => onTransicionar?.(foco, t)}
            >
              {LABEL_STATUS[t] ?? t}
            </Button>
          ))}
          {onAbrirDetalhe && (
            <Button size="sm" variant="default" className="h-7 px-3 text-[11px] font-bold ml-auto" onClick={onAbrirDetalhe}>
              Abrir
            </Button>
          )}
          {onVerNoMapa && (
            <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px]" onClick={onVerNoMapa}>
              <MapPin className="w-3 h-3 mr-1" />
              Mapa
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
