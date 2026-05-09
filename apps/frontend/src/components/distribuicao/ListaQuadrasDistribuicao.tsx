import { CheckSquare, Square } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { AtribuicaoState, CoberturaItem } from './types';
import type { AgenteSimples } from '@/hooks/queries/useAgentes';

interface Props {
  quadrasFiltradas: string[];
  qRegiaoMap: Record<string, string | null>;
  regiaoNomeMap: Record<string, string>;
  atribuicoes: Record<string, AtribuicaoState>;
  agentes: AgenteSimples[];
  agentesMap: Record<string, string>;
  cobertura: CoberturaItem[];
  contagemPorQ: Record<string, number>;
  selecionadas: Set<string>;
  onToggleQuadra: (q: string) => void;
  onSetAtribuicao: (q: string, agenteId: string) => void;
}

export function ListaQuadrasDistribuicao({
  quadrasFiltradas, qRegiaoMap, regiaoNomeMap,
  atribuicoes, agentes, agentesMap, cobertura, contagemPorQ,
  selecionadas, onToggleQuadra, onSetAtribuicao,
}: Props) {
  if (quadrasFiltradas.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-xs text-muted-foreground border rounded-xl">
        Nenhuma quadra para exibir.
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border">
      {/* Cabeçalho */}
      <div className="hidden shrink-0 border-b bg-muted/40 px-3 py-2 text-[10px] font-semibold text-muted-foreground lg:grid lg:grid-cols-[28px_90px_1fr_64px_180px_88px] lg:gap-2">
        <span />
        <span>Quadra</span>
        <span>Região</span>
        <span>Imóveis</span>
        <span>Agente</span>
        <span className="text-right">Status</span>
      </div>

      <div className="min-h-0 flex-1 divide-y divide-border/40 overflow-y-auto">
        {quadrasFiltradas.map((q) => {
          const st = atribuicoes[q] ?? { salvo: '', pendente: '' };
          const alterado = st.pendente !== st.salvo;
          const sel = selecionadas.has(q);
          const regiaoId = qRegiaoMap[q] ?? null;
          const regiaoNome = regiaoId ? (regiaoNomeMap[regiaoId] ?? '—') : '—';
          const cobQ = cobertura.find((c) => c.quarteirao === q);
          const nImoveis = contagemPorQ[q] ?? 0;

          return (
            <div
              key={q}
              className={cn(
                'flex flex-col lg:grid lg:grid-cols-[28px_90px_1fr_64px_180px_88px] gap-2 px-3 py-2.5 items-start lg:items-center transition-colors',
                sel && 'bg-primary/5',
                alterado && 'bg-amber-50/60 dark:bg-amber-950/10',
              )}
            >
              {/* Checkbox */}
              <button
                type="button"
                onClick={() => onToggleQuadra(q)}
                className="shrink-0 mt-0.5 lg:mt-0"
              >
                {sel ? (
                  <CheckSquare className="h-4 w-4 text-primary" />
                ) : (
                  <Square className="h-4 w-4 text-muted-foreground" />
                )}
              </button>

              {/* Quadra */}
              <span className="text-sm font-mono font-semibold">{q}</span>

              {/* Região */}
              <span className="text-xs text-muted-foreground truncate hidden lg:block">{regiaoNome}</span>

              {/* Imóveis */}
              <div className="hidden lg:block">
                <span className="text-xs">{nImoveis}</span>
                {cobQ && cobQ.total_imoveis > 0 && (
                  <Progress
                    value={Number(cobQ.pct_cobertura)}
                    className="h-1 mt-0.5 w-10"
                  />
                )}
              </div>

              {/* Agente */}
              <div className="w-full lg:w-auto">
                <Select
                  value={st.pendente || '__none__'}
                  onValueChange={(v) => onSetAtribuicao(q, v === '__none__' ? '' : v)}
                >
                  <SelectTrigger
                    className={cn(
                      'h-7 text-xs w-full',
                      alterado && 'border-amber-400 bg-amber-50/50 dark:bg-amber-950/20',
                    )}
                  >
                    <SelectValue placeholder="Selecionar agente…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Sem agente —</SelectItem>
                    {agentes.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {/* Mobile: show region + imoveis inline */}
                <div className="flex items-center gap-2 mt-1 lg:hidden">
                  <span className="text-[10px] text-muted-foreground">{regiaoNome}</span>
                  <span className="text-[10px] text-muted-foreground">·</span>
                  <span className="text-[10px] text-muted-foreground">{nImoveis} imóveis</span>
                </div>
              </div>

              {/* Status */}
              <div className="hidden lg:flex justify-end">
                {alterado ? (
                  <Badge className="text-[9px] bg-amber-500/15 text-amber-700 border-transparent">
                    pendente
                  </Badge>
                ) : st.salvo ? (
                  <Badge className="text-[9px] bg-emerald-500/15 text-emerald-700 border-transparent">
                    salvo
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[9px] text-muted-foreground">
                    sem agente
                  </Badge>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
