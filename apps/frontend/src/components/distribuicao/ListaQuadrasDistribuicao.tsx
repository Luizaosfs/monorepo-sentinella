import { useState, useMemo } from 'react';
import { CheckSquare, Square, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { AtribuicaoState, CoberturaItem } from './types';
import type { AgenteSimples } from '@/hooks/queries/useAgentes';

type SortCol = 'quadra' | 'bairro' | 'imoveis' | 'agente' | 'status';
type SortDir = 'asc' | 'desc';
type FilterStatus = 'all' | 'pendente' | 'salvo' | 'sem_agente';

interface Props {
  quadrasFiltradas: string[];
  qBairroMap: Record<string, string | null>;
  regiaoNomeMap: Record<string, string>;
  atribuicoes: Record<string, AtribuicaoState>;
  agentes: AgenteSimples[];
  agentesMap: Record<string, string>;
  agentColorMap: Record<string, string>;
  cobertura: CoberturaItem[];
  contagemPorQ: Record<string, number>;
  selecionadas: Set<string>;
  uuidToCode: Record<string, string>;
  onToggleQuadra: (q: string) => void;
  onSetAtribuicao: (q: string, agenteId: string) => void;
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ArrowUpDown className="h-3 w-3 opacity-30" />;
  return dir === 'asc'
    ? <ArrowUp className="h-3 w-3 text-primary" />
    : <ArrowDown className="h-3 w-3 text-primary" />;
}

function HeaderBtn({
  col, label, sortCol, sortDir, onSort,
}: {
  col: SortCol; label: string; sortCol: SortCol | null; sortDir: SortDir;
  onSort: (col: SortCol) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSort(col)}
      className="flex items-center gap-1 hover:text-foreground transition-colors select-none"
    >
      {label}
      <SortIcon active={sortCol === col} dir={sortDir} />
    </button>
  );
}

export function ListaQuadrasDistribuicao({
  quadrasFiltradas, qBairroMap, regiaoNomeMap,
  atribuicoes, agentes, agentesMap, agentColorMap, cobertura, contagemPorQ,
  selecionadas, uuidToCode, onToggleQuadra, onSetAtribuicao,
}: Props) {
  const [sortCol, setSortCol] = useState<SortCol | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [filterAgente, setFilterAgente] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');

  const toggleSort = (col: SortCol) => {
    if (sortCol === col) {
      if (sortDir === 'asc') { setSortDir('desc'); }
      else { setSortCol(null); setSortDir('asc'); }
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  };

  const rows = useMemo(() => {
    let data = [...quadrasFiltradas];

    if (filterAgente) {
      data = data.filter(q => (atribuicoes[q]?.pendente ?? '') === filterAgente);
    }

    if (filterStatus !== 'all') {
      data = data.filter(q => {
        const st = atribuicoes[q] ?? { salvo: '', pendente: '' };
        const alt = st.pendente !== st.salvo;
        if (filterStatus === 'pendente') return alt;
        if (filterStatus === 'salvo') return !alt && !!st.salvo;
        if (filterStatus === 'sem_agente') return !alt && !st.salvo;
        return true;
      });
    }

    if (sortCol) {
      data.sort((a, b) => {
        const stA = atribuicoes[a] ?? { salvo: '', pendente: '' };
        const stB = atribuicoes[b] ?? { salvo: '', pendente: '' };
        let valA: string | number = '';
        let valB: string | number = '';

        if (sortCol === 'quadra') {
          valA = uuidToCode[a] ?? a;
          valB = uuidToCode[b] ?? b;
        } else if (sortCol === 'bairro') {
          const bA = qBairroMap[a]; valA = bA ? (regiaoNomeMap[bA] ?? '') : '';
          const bB = qBairroMap[b]; valB = bB ? (regiaoNomeMap[bB] ?? '') : '';
        } else if (sortCol === 'imoveis') {
          valA = contagemPorQ[a] ?? 0;
          valB = contagemPorQ[b] ?? 0;
        } else if (sortCol === 'agente') {
          valA = stA.pendente ? (agentesMap[stA.pendente] ?? '') : '';
          valB = stB.pendente ? (agentesMap[stB.pendente] ?? '') : '';
        } else if (sortCol === 'status') {
          const pri = (st: AtribuicaoState) =>
            st.pendente !== st.salvo ? 0 : st.salvo ? 1 : 2;
          valA = pri(stA); valB = pri(stB);
        }

        if (typeof valA === 'number' && typeof valB === 'number') {
          return sortDir === 'asc' ? valA - valB : valB - valA;
        }
        const cmp = String(valA).localeCompare(String(valB), 'pt-BR');
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }

    return data;
  }, [quadrasFiltradas, sortCol, sortDir, filterAgente, filterStatus,
      atribuicoes, uuidToCode, qBairroMap, regiaoNomeMap, contagemPorQ, agentesMap]);

  if (quadrasFiltradas.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-xs text-muted-foreground border rounded-xl">
        Nenhuma quadra para exibir.
      </div>
    );
  }

  const filterSelect = 'h-5 rounded border border-border/60 bg-background px-1 text-[9px] text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer hover:border-border transition-colors';

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border">
      {/* Cabeçalho com sort + filter */}
      <div className="hidden shrink-0 border-b bg-muted/50 lg:block">
        {/* Sort row */}
        <div className="grid grid-cols-[28px_80px_1fr_80px_200px_80px] gap-2 px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          <span />
          <HeaderBtn col="quadra" label="Quadra" sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
          <HeaderBtn col="bairro" label="Bairro" sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
          <HeaderBtn col="imoveis" label="Imóveis" sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
          <HeaderBtn col="agente" label="Agente" sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
          <div className="flex justify-end">
            <HeaderBtn col="status" label="Status" sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
          </div>
        </div>
        {/* Filter row */}
        <div className="grid grid-cols-[28px_80px_1fr_80px_200px_80px] gap-2 px-3 pb-1.5">
          <span /><span /><span /><span />
          {/* Agente filter */}
          <select
            value={filterAgente}
            onChange={e => setFilterAgente(e.target.value)}
            className={filterSelect}
          >
            <option value="">Todos agentes</option>
            {agentes.map(a => (
              <option key={a.id} value={a.id}>{a.nome}</option>
            ))}
          </select>
          {/* Status filter */}
          <div className="flex justify-end">
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value as FilterStatus)}
              className={filterSelect}
            >
              <option value="all">Todos</option>
              <option value="pendente">Pendente</option>
              <option value="salvo">Salvo</option>
              <option value="sem_agente">Sem agente</option>
            </select>
          </div>
        </div>
      </div>

      {/* Contagem de resultados quando filtrado */}
      {(filterAgente || filterStatus !== 'all') && (
        <div className="hidden shrink-0 border-b bg-muted/20 px-3 py-1 text-[10px] text-muted-foreground lg:flex items-center justify-between">
          <span>{rows.length} de {quadrasFiltradas.length} quadras</span>
          <button
            type="button"
            onClick={() => { setFilterAgente(''); setFilterStatus('all'); }}
            className="text-primary hover:underline"
          >
            Limpar filtros
          </button>
        </div>
      )}

      <div className="min-h-0 flex-1 divide-y divide-border/30 overflow-y-auto">
        {rows.length === 0 ? (
          <div className="flex items-center justify-center h-20 text-xs text-muted-foreground">
            Nenhuma quadra corresponde aos filtros.
          </div>
        ) : rows.map((q) => {
          const st = atribuicoes[q] ?? { salvo: '', pendente: '' };
          const alterado = st.pendente !== st.salvo;
          const sel = selecionadas.has(q);
          const bairroId = qBairroMap[q] ?? null;
          const regiaoNome = bairroId ? (regiaoNomeMap[bairroId] ?? '—') : '—';
          const cobQ = cobertura.find((c) => c.quarteirao === (uuidToCode[q] ?? q));
          const nImoveis = contagemPorQ[q] ?? 0;
          const agColor = st.pendente ? (agentColorMap[st.pendente] ?? '#9ca3af') : 'transparent';

          return (
            <div
              key={q}
              className={cn(
                'flex flex-col lg:grid lg:grid-cols-[28px_80px_1fr_80px_200px_80px] gap-2 border-l-[3px] pl-2.5 pr-3 py-2 items-start lg:items-center transition-colors',
                sel
                  ? 'bg-primary/5'
                  : alterado
                    ? 'bg-amber-50/50 dark:bg-amber-950/10'
                    : 'hover:bg-muted/20',
              )}
              style={{ borderLeftColor: agColor }}
            >
              {/* Checkbox */}
              <button type="button" onClick={() => onToggleQuadra(q)} className="shrink-0 mt-0.5 lg:mt-0">
                {sel
                  ? <CheckSquare className="h-4 w-4 text-primary" />
                  : <Square className="h-4 w-4 text-muted-foreground/40" />}
              </button>

              {/* Quadra */}
              <span className="font-mono text-sm font-bold tracking-tight">{uuidToCode[q] ?? q}</span>

              {/* Bairro */}
              <span className="hidden truncate text-xs text-muted-foreground lg:block">{regiaoNome}</span>

              {/* Imóveis */}
              <div className="hidden lg:flex flex-col gap-0.5">
                <span className="text-xs tabular-nums font-medium">{nImoveis}</span>
                {cobQ && Number(cobQ.total_imoveis) > 0 && (
                  <Progress value={Number(cobQ.pct_cobertura)} className="h-1 w-12" />
                )}
              </div>

              {/* Agente — dot + select */}
              <div className="w-full lg:w-auto flex flex-col gap-0.5">
                <div className="flex items-center gap-1.5">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-black/10"
                    style={{ backgroundColor: st.pendente ? (agentColorMap[st.pendente] ?? '#9ca3af') : '#e5e7eb' }}
                  />
                  <Select
                    value={st.pendente || '__none__'}
                    onValueChange={(v) => onSetAtribuicao(q, v === '__none__' ? '' : v)}
                  >
                    <SelectTrigger
                      className={cn(
                        'h-7 flex-1 text-xs',
                        alterado && 'border-amber-400 bg-amber-50/50 dark:bg-amber-950/20',
                      )}
                    >
                      <SelectValue placeholder="Sem agente…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— Sem agente —</SelectItem>
                      {agentes.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          <span className="flex items-center gap-2">
                            <span
                              className="h-2 w-2 shrink-0 rounded-full"
                              style={{ backgroundColor: agentColorMap[a.id] ?? '#9ca3af' }}
                            />
                            {a.nome}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {/* Mobile: bairro + imóveis */}
                <div className="flex items-center gap-2 pl-4 lg:hidden">
                  <span className="text-[10px] text-muted-foreground">{regiaoNome}</span>
                  <span className="text-[10px] text-muted-foreground">·</span>
                  <span className="text-[10px] text-muted-foreground">{nImoveis} im.</span>
                </div>
              </div>

              {/* Status */}
              <div className="hidden lg:flex justify-end">
                {alterado ? (
                  <Badge className="text-[9px] bg-amber-500/15 text-amber-700 border-transparent">pendente</Badge>
                ) : st.salvo ? (
                  <Badge className="text-[9px] bg-emerald-500/15 text-emerald-700 border-transparent">salvo</Badge>
                ) : (
                  <Badge variant="outline" className="text-[9px] text-muted-foreground">sem agente</Badge>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
