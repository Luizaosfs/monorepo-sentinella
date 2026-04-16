/**
 * TriagemTerritorial — visualização agrupada da fila de triagem.
 *
 * Funcionalidades P2.1:
 * - Drill-down com dados operacionais reais (não UUIDs)
 * - Seleção individual de focos para atribuição parcial
 * - Filtros: prioridade e somente elegíveis
 * - Atribuição de grupo inteiro ou selecionados
 * - Feedback: atribuídos / ignorados
 */

import { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { logEvento } from '@/lib/pilotoEventos';
import {
  Building2, MapPin, Map, AlertCircle, Users, ChevronDown, ChevronUp,
  Layers, UserCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/foco/StatusBadge';
import { PrioridadeBadge } from '@/components/foco/PrioridadeBadge';
import { useFocosRiscoAgrupados } from '@/hooks/queries/useFocosRiscoAgrupados';
import { useFocosDoGrupo } from '@/hooks/queries/useFocosDoGrupo';
import { api } from '@/services/api';
import {
  ordinalToPrioridade,
  LABEL_AGRUPADOR,
  isElegivelParaAtribuicao,
  filtrarGrupos,
} from '@/lib/triagemTerritorial';
import type { FocoRiscoAgrupado, FocoAgrupadorTipo, FocoRiscoStatus } from '@/types/database';

// ── Config visual ─────────────────────────────────────────────────────────────

const AGRUPADOR_CONFIG: Record<FocoAgrupadorTipo, {
  Icon: React.ElementType;
  colorClass: string;
  borderClass: string;
}> = {
  quadra: { Icon: Building2, colorClass: 'text-indigo-600 dark:text-indigo-400', borderClass: 'border-l-indigo-400' },
  bairro: { Icon: MapPin,    colorClass: 'text-blue-600 dark:text-blue-400',    borderClass: 'border-l-blue-400'    },
  regiao: { Icon: Map,       colorClass: 'text-violet-600 dark:text-violet-400', borderClass: 'border-l-violet-400' },
  item:   { Icon: AlertCircle, colorClass: 'text-gray-500 dark:text-gray-400', borderClass: 'border-l-gray-300'    },
};

// ── Card de grupo ─────────────────────────────────────────────────────────────

function GrupoCard({
  grupo,
  agentes,
  clienteId,
}: {
  grupo: FocoRiscoAgrupado;
  agentes: { id: string; nome?: string | null; email: string }[];
  clienteId: string | null | undefined;
}) {
  const qc = useQueryClient();
  const [agenteId, setAgenteId]       = useState('');
  const [loading, setLoading]         = useState(false);
  const [expandido, setExpandido]     = useState(false);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());

  const { data: focos = [], isLoading: focosLoading } = useFocosDoGrupo(
    grupo.foco_ids,
    expandido,
  );

  const config = AGRUPADOR_CONFIG[grupo.agrupador_tipo];
  const Icon = config.Icon;
  const prioridade = ordinalToPrioridade(grupo.prioridade_max_ord);

  // IDs a atribuir: selecionados manuais ou todos os foco_ids do grupo (RPC filtra elegíveis)
  const focoIdsParaAtribuir = selecionados.size > 0
    ? [...selecionados]
    : grupo.foco_ids;

  const btnCount = selecionados.size > 0
    ? selecionados.size
    : grupo.quantidade_elegivel;

  function toggleFoco(id: string, checked: boolean) {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id); else next.delete(id);
      return next;
    });
  }

  function toggleTodos() {
    const elegiveis = focos.filter((f) => isElegivelParaAtribuicao(f.status as FocoRiscoStatus));
    if (selecionados.size === elegiveis.length) {
      setSelecionados(new Set());
    } else {
      setSelecionados(new Set(elegiveis.map((f) => f.id)));
    }
  }

  async function handleAtribuir() {
    if (!agenteId || btnCount === 0) return;
    setLoading(true);
    try {
      const result = await api.focosRisco.atribuirAgenteLote(
        focoIdsParaAtribuir,
        agenteId,
        `Distribuição territorial: ${LABEL_AGRUPADOR[grupo.agrupador_tipo]} ${grupo.agrupador_valor}`,
      );
      qc.invalidateQueries({ queryKey: ['focos_risco'] });
      qc.invalidateQueries({ queryKey: ['focos_risco_agrupados'] });
      qc.invalidateQueries({ queryKey: ['focos_do_grupo'] });
      qc.invalidateQueries({ queryKey: ['focos_risco_triagem_kpis'], exact: false });
      logEvento('triagem_distribuicao_lote', clienteId, {
        atribuidos: result.atribuidos,
        ignorados: result.ignorados,
        agrupador_tipo: grupo.agrupador_tipo,
        agrupador_valor: grupo.agrupador_valor,
        selecionados: selecionados.size,
      });
      const extra = result.ignorados > 0
        ? ` (${result.ignorados} já em execução — ignorados)`
        : '';
      toast.success(`${result.atribuidos} foco(s) atribuído(s)${extra}.`);
      setAgenteId('');
      setSelecionados(new Set());
    } catch {
      toast.error('Erro ao distribuir focos. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  const elegiveisList = focos.filter((f) => isElegivelParaAtribuicao(f.status as FocoRiscoStatus));
  const todosSelecionados = elegiveisList.length > 0 && selecionados.size === elegiveisList.length;

  return (
    <Card className={`rounded-xl border border-border/60 border-l-[3px] ${config.borderClass}`}>
      <CardContent className="p-4 space-y-3">

        {/* ── Linha principal ── */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5 min-w-0">
            <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${config.colorClass}`} />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className={`text-[10px] font-bold uppercase tracking-wider ${config.colorClass}`}>
                  {LABEL_AGRUPADOR[grupo.agrupador_tipo]}
                </span>
                {prioridade && (
                  <PrioridadeBadge prioridade={prioridade as 'P1'|'P2'|'P3'|'P4'|'P5'} />
                )}
              </div>
              <p className="text-sm font-semibold text-foreground leading-tight truncate">
                {grupo.agrupador_tipo === 'quadra'
                  ? `Quadra ${grupo.agrupador_valor}`
                  : grupo.agrupador_valor}
              </p>
            </div>
          </div>

          {/* Contadores */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <p className="text-lg font-black text-foreground leading-none">{grupo.quantidade_focos}</p>
              <p className="text-[10px] text-muted-foreground">focos</p>
            </div>
            {grupo.quantidade_elegivel > 0 && grupo.quantidade_elegivel !== grupo.quantidade_focos && (
              <div className="text-right">
                <p className="text-lg font-black text-blue-600 dark:text-blue-400 leading-none">
                  {grupo.quantidade_elegivel}
                </p>
                <p className="text-[10px] text-muted-foreground">elegíveis</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Status pills ── */}
        <div className="flex flex-wrap gap-1.5">
          {grupo.ct_em_triagem > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
              {grupo.ct_em_triagem} em triagem
            </span>
          )}
          {grupo.ct_aguarda_inspecao > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">
              {grupo.ct_aguarda_inspecao} aguardando inspeção
            </span>
          )}
          {grupo.ct_sem_responsavel > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
              {grupo.ct_sem_responsavel} sem responsável
            </span>
          )}
          {grupo.quantidade_elegivel === 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-500 dark:bg-gray-800/30">
              Todos em execução
            </span>
          )}
        </div>

        {/* ── Atribuição ── */}
        {grupo.quantidade_elegivel > 0 && (
          <div className="flex gap-2 pt-1">
            <Select value={agenteId} onValueChange={setAgenteId}>
              <SelectTrigger className="flex-1 h-8 text-xs">
                <SelectValue placeholder="Selecionar agente..." />
              </SelectTrigger>
              <SelectContent>
                {agentes.map((a) => (
                  <SelectItem key={a.id} value={a.id} className="text-xs">
                    {a.nome ?? a.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              className="h-8 px-3 text-xs font-semibold shrink-0"
              disabled={!agenteId || loading || btnCount === 0}
              onClick={handleAtribuir}
            >
              <Users className="w-3.5 h-3.5 mr-1" />
              {loading
                ? 'Atribuindo...'
                : selecionados.size > 0
                  ? `Atribuir selecionados (${selecionados.size})`
                  : `Atribuir ${grupo.quantidade_elegivel}`}
            </Button>
          </div>
        )}

        {/* ── Expandir ── */}
        <button
          type="button"
          className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setExpandido((v) => !v)}
        >
          {expandido ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          {expandido ? 'Ocultar focos' : `Ver ${grupo.quantidade_focos} foco${grupo.quantidade_focos !== 1 ? 's' : ''}`}
        </button>

        {/* ── Lista expandida com dados reais ── */}
        {expandido && (
          <div className="space-y-1.5 pt-1">
            {focosLoading ? (
              <div className="space-y-1.5">
                {[0, 1, 2].map((i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
              </div>
            ) : (
              <>
                {/* Selecionar todos elegíveis */}
                {elegiveisList.length > 1 && (
                  <button
                    type="button"
                    className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground mb-1"
                    onClick={toggleTodos}
                  >
                    <Checkbox
                      checked={todosSelecionados}
                      className="w-3.5 h-3.5 pointer-events-none"
                    />
                    {todosSelecionados ? 'Desselecionar todos' : `Selecionar ${elegiveisList.length} elegíveis`}
                  </button>
                )}

                {focos.map((foco) => {
                  const elegivel = isElegivelParaAtribuicao(foco.status as FocoRiscoStatus);
                  const selecionado = selecionados.has(foco.id);
                  const endereco = [foco.logradouro, foco.numero].filter(Boolean).join(', ')
                    || foco.endereco_normalizado
                    || '—';
                  const localidade = [foco.bairro, foco.regiao_nome].filter(Boolean).join(' · ');

                  return (
                    <div
                      key={foco.id}
                      className={`flex items-start gap-2.5 p-2.5 rounded-lg transition-colors ${
                        selecionado
                          ? 'bg-primary/8 border border-primary/20'
                          : 'bg-muted/40 border border-transparent'
                      }`}
                    >
                      {/* Checkbox (apenas elegíveis) */}
                      <div className="mt-0.5 shrink-0">
                        {elegivel ? (
                          <Checkbox
                            checked={selecionado}
                            onCheckedChange={(checked) => toggleFoco(foco.id, !!checked)}
                            className="w-4 h-4"
                          />
                        ) : (
                          <div className="w-4 h-4" />
                        )}
                      </div>

                      {/* Dados do foco */}
                      <div className="flex-1 min-w-0">
                        {foco.codigo_foco && (
                          <p className="text-[10px] font-mono text-muted-foreground leading-tight">
                            {foco.codigo_foco}
                          </p>
                        )}
                        <p className="text-xs font-semibold text-foreground truncate leading-tight">
                          {endereco}
                        </p>
                        {localidade && (
                          <p className="text-[10px] text-muted-foreground truncate">{localidade}</p>
                        )}
                        {foco.responsavel_nome && (
                          <p className="text-[10px] text-muted-foreground flex items-center gap-0.5 mt-0.5">
                            <UserCheck className="w-2.5 h-2.5 shrink-0" />
                            {foco.responsavel_nome}
                          </p>
                        )}
                      </div>

                      {/* Badges */}
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <StatusBadge status={foco.status as FocoRiscoStatus} />
                        {foco.prioridade && (
                          <PrioridadeBadge prioridade={foco.prioridade as 'P1'|'P2'|'P3'|'P4'|'P5'} />
                        )}
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

interface Props {
  clienteId: string | null | undefined;
  agentes: { id: string; nome?: string | null; email: string }[];
}

export function TriagemTerritorial({ clienteId, agentes }: Props) {
  const { data: grupos = [], isLoading } = useFocosRiscoAgrupados(clienteId);

  // Filtros
  const [filtroPrioridadeOrd, setFiltroPrioridadeOrd]   = useState<number | null>(null);
  const [somenteElegiveis, setSomenteElegiveis]         = useState(false);
  const [somentesSemResponsavel, setSomentesSemResponsavel] = useState(false);

  const gruposFiltrados = useMemo(
    () => filtrarGrupos(grupos, { prioridadeMaxOrd: filtroPrioridadeOrd, somenteElegiveis, somentesSemResponsavel }),
    [grupos, filtroPrioridadeOrd, somenteElegiveis, somentesSemResponsavel],
  );

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}
      </div>
    );
  }

  if (grupos.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <Layers className="w-10 h-10 text-muted-foreground/30" />
        <p className="text-sm font-semibold text-foreground">Nenhum foco ativo no momento</p>
        <p className="text-xs text-muted-foreground max-w-xs">
          Quando houver focos em triagem ou execução, eles serão agrupados aqui por território.
        </p>
      </div>
    );
  }

  const totalFocos     = grupos.reduce((s, g) => s + g.quantidade_focos, 0);
  const totalElegiveis = grupos.reduce((s, g) => s + g.quantidade_elegivel, 0);

  return (
    <div className="space-y-4">

      {/* ── Filtros ── */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Prioridade */}
        {[
          { label: 'Todas', ord: null },
          { label: 'P1',    ord: 1 },
          { label: 'P1–P2', ord: 2 },
          { label: 'P1–P3', ord: 3 },
        ].map(({ label, ord }) => (
          <button
            key={label}
            type="button"
            onClick={() => setFiltroPrioridadeOrd(ord)}
            className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors ${
              filtroPrioridadeOrd === ord
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border bg-background text-muted-foreground hover:bg-muted'
            }`}
          >
            {label}
          </button>
        ))}

        <div className="w-px h-4 bg-border mx-1" />

        {/* Somente elegíveis */}
        <button
          type="button"
          onClick={() => setSomenteElegiveis((v) => !v)}
          className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors ${
            somenteElegiveis
              ? 'bg-primary text-primary-foreground border-primary'
              : 'border-border bg-background text-muted-foreground hover:bg-muted'
          }`}
        >
          Somente distribuíveis
        </button>

        {/* Sem responsável */}
        <button
          type="button"
          onClick={() => setSomentesSemResponsavel((v) => !v)}
          className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors ${
            somentesSemResponsavel
              ? 'bg-amber-500 text-white border-amber-500'
              : 'border-border bg-background text-muted-foreground hover:bg-muted'
          }`}
        >
          Sem responsável
        </button>
      </div>

      {/* ── Resumo ── */}
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span>
          <strong className="text-foreground">{gruposFiltrados.length}</strong>
          {gruposFiltrados.length !== grupos.length && ` de ${grupos.length}`}
          {' '}grupo{gruposFiltrados.length !== 1 ? 's' : ''}
        </span>
        <span>·</span>
        <span>
          <strong className="text-foreground">{totalFocos}</strong> foco{totalFocos !== 1 ? 's' : ''}
        </span>
        {totalElegiveis < totalFocos && (
          <>
            <span>·</span>
            <span>
              <strong className="text-blue-600 dark:text-blue-400">{totalElegiveis}</strong> elegíveis
            </span>
          </>
        )}
      </div>

      {/* ── Lista de grupos ── */}
      {gruposFiltrados.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">
          Nenhum grupo corresponde aos filtros selecionados.
        </p>
      ) : (
        <div className="space-y-3">
          {gruposFiltrados.map((grupo) => (
            <GrupoCard
              key={`${grupo.agrupador_tipo}:${grupo.agrupador_valor}`}
              grupo={grupo}
              agentes={agentes}
              clienteId={clienteId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
