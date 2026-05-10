import { useMemo, useRef, useEffect } from 'react';
import { Search, ChevronDown, ChevronRight, CheckSquare, Square, Plus, MapPin, AlertTriangle, PenLine, PenSquare } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { AtribuicaoState, Filtro, RegiaoEntry } from './types';

interface Props {
  porRegiao: Map<string, RegiaoEntry>;
  bairroIds: string[];
  atribuicoes: Record<string, AtribuicaoState>;
  selecionadas: Set<string>;
  abertas: Set<string>;
  searchTerm: string;
  filtro: Filtro;
  agentesMap: Record<string, string>;
  agentColorMap: Record<string, string>;
  contagemPorQ: Record<string, number>;
  /** codigo → tem geometria cadastrada */
  quarteiraoGeomMap?: Record<string, boolean>;
  /** Quarteirão destacado (ex: clicado no mapa) — objeto com tick para re-disparar no mesmo item */
  highlightQ?: { codigo: string; tick: number } | null;
  onSearchChange: (v: string) => void;
  onFiltroChange: (f: Filtro) => void;
  onToggleQuadra: (q: string) => void;
  onSelectQuadras: (qs: string[], select: boolean) => void;
  onToggleAberta: (bairroId: string) => void;
  onGerarQuarteiroes?: (bairroId: string) => void;
  onDesenharQuarteirao?: (codigo: string, bairroId: string | null) => void;
  /** Abre modal de desenho de nova quadra para uma região específica */
  onDesenharNova?: (bairroId: string) => void;
  onExpandAll?: () => void;
  onCollapseAll?: () => void;
}

const FILTROS: { value: Filtro; label: string }[] = [
  { value: 'todas', label: 'Todas' },
  { value: 'atribuidas', label: 'Atribuídas' },
  { value: 'sem_atribuicao', label: 'Sem agente' },
  { value: 'sem_geometria', label: 'Sem mapa' },
  { value: 'selecionadas', label: 'Selecionadas' },
];

function qsVisiveis(
  qs: string[],
  nome: string,
  term: string,
  filtro: Filtro,
  atribuicoes: Record<string, AtribuicaoState>,
  quarteiraoGeomMap?: Record<string, boolean>,
  selecionadas?: Set<string>,
) {
  return qs.filter((q) => {
    if (term && !q.toLowerCase().includes(term) && !nome.toLowerCase().includes(term)) return false;
    if (filtro === 'atribuidas') return !!atribuicoes[q]?.pendente;
    if (filtro === 'sem_atribuicao') return !atribuicoes[q]?.pendente;
    if (filtro === 'sem_geometria') return quarteiraoGeomMap ? !quarteiraoGeomMap[q] : false;
    if (filtro === 'selecionadas') return selecionadas?.has(q) ?? false;
    return true;
  });
}

export function PainelRegioesQuadras({
  porRegiao, bairroIds, atribuicoes, selecionadas, abertas,
  searchTerm, filtro, agentesMap, agentColorMap, contagemPorQ, quarteiraoGeomMap,
  highlightQ,
  onSearchChange, onFiltroChange, onToggleQuadra, onSelectQuadras, onToggleAberta,
  onGerarQuarteiroes, onDesenharQuarteirao, onDesenharNova,
  onExpandAll, onCollapseAll,
}: Props) {
  const term = searchTerm.trim().toLowerCase();

  // Ref map for scroll-to-item when map click highlights a quarteirao
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  useEffect(() => {
    if (!highlightQ?.codigo) return;
    const el = itemRefs.current.get(highlightQ.codigo);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      el.classList.add('ring-2', 'ring-primary', 'ring-offset-1');
      const t = setTimeout(() => el.classList.remove('ring-2', 'ring-primary', 'ring-offset-1'), 1200);
      return () => clearTimeout(t);
    }
  // highlightQ is an object — effect re-fires on every new object reference (tick ensures uniqueness)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightQ]);

  const bairroIdsFiltrados = useMemo(() => {
    return bairroIds.filter((rId) => {
      if (!term && filtro === 'todas') return true;
      const { nome, qs } = porRegiao.get(rId)!;
      const vis = qsVisiveis(qs, nome, term, filtro, atribuicoes, quarteiraoGeomMap, selecionadas);
      return vis.length > 0 || (term && nome.toLowerCase().includes(term));
    });
  }, [bairroIds, porRegiao, term, filtro, atribuicoes, quarteiraoGeomMap, selecionadas]);

  return (
    <div className="flex flex-col h-full border rounded-xl bg-card overflow-hidden">
      {/* Header */}
      <div className="px-3 pt-3 pb-2 border-b space-y-2 flex-shrink-0">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-foreground">Bairros e Quadras</p>
          <div className="flex gap-1">
            {onExpandAll && (
              <button
                type="button"
                onClick={onExpandAll}
                className="text-[10px] text-muted-foreground hover:text-primary px-1.5 py-0.5 rounded transition-colors"
                title="Expandir todos os bairros"
              >
                Expandir tudo
              </button>
            )}
            {onCollapseAll && (
              <button
                type="button"
                onClick={onCollapseAll}
                className="text-[10px] text-muted-foreground hover:text-primary px-1.5 py-0.5 rounded transition-colors"
                title="Colapsar todos os bairros"
              >
                Colapsar tudo
              </button>
            )}
          </div>
        </div>
        <div className="relative">
          <Search className="h-3.5 w-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
          <Input
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar quadra…"
            className="pl-8 h-7 text-xs"
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          {FILTROS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => onFiltroChange(f.value)}
              className={cn(
                'text-[10px] px-2 py-0.5 rounded-full border transition-colors',
                filtro === f.value
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'text-muted-foreground border-border hover:border-primary/50',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto divide-y divide-border/40">
        {bairroIdsFiltrados.length === 0 ? (
          <p className="text-xs text-muted-foreground p-4 text-center">
            {!term && filtro === 'todas' ? 'Nenhum bairro cadastrado.' : 'Nenhuma quadra encontrada.'}
          </p>
        ) : (
          bairroIdsFiltrados.map((bairroId) => {
            const { nome, qs } = porRegiao.get(bairroId)!;
            const aberto = abertas.has(bairroId);
            const vis = qsVisiveis(qs, nome, term, filtro, atribuicoes, quarteiraoGeomMap, selecionadas);
            const todasSel = vis.length > 0 && vis.every((q) => selecionadas.has(q));
            const algumasSel = vis.some((q) => selecionadas.has(q));
            const atribuidos = vis.filter((q) => !!atribuicoes[q]?.pendente).length;
            const semGeom = quarteiraoGeomMap
              ? vis.filter((q) => !quarteiraoGeomMap[q]).length
              : 0;

            return (
              <div key={bairroId}>
                {/* Cabeçalho da região */}
                <div className="bg-muted/30 hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-1.5 px-3 py-2">
                  <button
                    type="button"
                    onClick={() => vis.length > 0 && onSelectQuadras(vis, !todasSel)}
                    className="shrink-0 text-muted-foreground hover:text-primary"
                    title={todasSel ? 'Desmarcar todas' : 'Selecionar todas'}
                  >
                    {todasSel ? (
                      <CheckSquare className="h-3.5 w-3.5 text-primary" />
                    ) : algumasSel ? (
                      <CheckSquare className="h-3.5 w-3.5 text-primary/50" />
                    ) : (
                      <Square className="h-3.5 w-3.5" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => onToggleAberta(bairroId)}
                    className="flex flex-1 items-center gap-1.5 min-w-0 text-left"
                  >
                    {aberto ? (
                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    )}
                    <span className="text-xs font-semibold truncate">{nome}</span>
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-[9px] h-4 px-1 shrink-0 ml-auto',
                        atribuidos === vis.length && vis.length > 0 && 'bg-emerald-50 border-emerald-300 text-emerald-700',
                      )}
                    >
                      {atribuidos}/{vis.length}
                    </Badge>
                    {semGeom > 0 && (
                      <AlertTriangle
                        className="h-3 w-3 text-amber-400 shrink-0"
                        title={`${semGeom} sem geometria`}
                      />
                    )}
                  </button>
                  {/* Botão: desenhar nova quadra nesta região */}
                  {onDesenharNova && bairroId !== '__sem_regiao__' && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onDesenharNova(bairroId); }}
                      className="shrink-0 text-muted-foreground hover:text-primary p-0.5 rounded transition-colors"
                      title="Desenhar nova quadra nesta região"
                    >
                      <PenSquare className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {onGerarQuarteiroes && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onGerarQuarteiroes(bairroId); }}
                      className="shrink-0 text-muted-foreground hover:text-primary p-0.5 rounded transition-colors"
                      title="Gerar quarteirões nesta região"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                {/* Attribution progress strip */}
                {vis.length > 0 && (
                  <div className="h-0.5 bg-border/30">
                    <div
                      className={cn(
                        'h-full transition-all duration-300',
                        atribuidos === vis.length
                          ? 'bg-emerald-400/70'
                          : atribuidos > 0
                            ? 'bg-amber-400/60'
                            : '',
                      )}
                      style={{ width: `${Math.round((atribuidos / vis.length) * 100)}%` }}
                    />
                  </div>
                )}
                </div>

                {/* Linhas de quadra */}
                {aberto && vis.length === 0 && (
                  <p className="px-8 py-2 text-xs text-muted-foreground italic">
                    {qs.length === 0
                      ? 'Nenhum quarteirão. Clique em + para gerar.'
                      : 'Nenhum resultado para este filtro.'}
                  </p>
                )}
                {aberto &&
                  vis.map((q) => {
                    const st = atribuicoes[q] ?? { salvo: '', pendente: '' };
                    const alterado = st.pendente !== st.salvo;
                    const sel = selecionadas.has(q);
                    const isHighlight = highlightQ?.codigo === q;
                    const hasGeom = quarteiraoGeomMap ? quarteiraoGeomMap[q] : undefined;
                    const agenteId = st.pendente;
                    const agentColor = agenteId ? (agentColorMap[agenteId] ?? '#6b7280') : undefined;

                    return (
                      <div
                        key={q}
                        ref={(el) => {
                          if (el) itemRefs.current.set(q, el);
                          else itemRefs.current.delete(q);
                        }}
                        className={cn(
                          'group flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-muted/20 transition-all border-l-2 rounded-sm',
                          sel ? 'bg-primary/5 border-l-primary' : 'border-l-transparent',
                          alterado && !sel && 'border-l-amber-400',
                          isHighlight && 'bg-primary/10',
                        )}
                        onClick={() => onToggleQuadra(q)}
                      >
                        {sel ? (
                          <CheckSquare className="h-3.5 w-3.5 text-primary shrink-0" />
                        ) : (
                          <Square className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        )}

                        {/* Geometry status icon */}
                        {quarteiraoGeomMap !== undefined && (
                          hasGeom ? (
                            <MapPin className="h-3 w-3 text-emerald-500 shrink-0" title="Geometria cadastrada" />
                          ) : (
                            <AlertTriangle className="h-3 w-3 text-amber-400 shrink-0" title="Sem geometria" />
                          )
                        )}

                        <span className="text-xs font-mono font-medium">{q}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {contagemPorQ[q] ?? 0} im.
                        </span>

                        {st.pendente ? (
                          <span
                            className={cn(
                              'ml-auto text-[10px] truncate max-w-[64px] flex items-center gap-1',
                              alterado ? 'text-amber-600' : 'text-emerald-600',
                            )}
                          >
                            {agentColor && (
                              <span
                                className="inline-block h-2 w-2 rounded-full shrink-0"
                                style={{ background: agentColor }}
                              />
                            )}
                            {agentesMap[st.pendente] ?? '?'}
                          </span>
                        ) : (
                          <span className="ml-auto text-[10px] text-muted-foreground/50">—</span>
                        )}

                        {/* Draw/Edit geometry button — visible on hover */}
                        {onDesenharQuarteirao && (
                          <button
                            type="button"
                            className="opacity-0 group-hover:opacity-100 shrink-0 p-0.5 rounded text-muted-foreground hover:text-primary transition-opacity"
                            title={hasGeom ? 'Editar geometria' : 'Desenhar geometria'}
                            onClick={(e) => {
                              e.stopPropagation();
                              onDesenharQuarteirao(q, bairroId === '__sem_regiao__' ? null : bairroId);
                            }}
                          >
                            <PenLine
                              className={cn(
                                'h-3 w-3',
                                hasGeom ? 'text-muted-foreground' : 'text-amber-500',
                              )}
                            />
                          </button>
                        )}
                      </div>
                    );
                  })}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
