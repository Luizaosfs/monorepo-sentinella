import { useState } from 'react';
import { UserCheck, X, CheckSquare, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { AgenteSimples } from '@/hooks/queries/useAgentes';
import type { AtribuicaoState } from './types';

interface Props {
  selecionadas: Set<string>;
  agentes: AgenteSimples[];
  atribuicoes: Record<string, AtribuicaoState>;
  agentesMap: Record<string, string>;
  qBairroMap: Record<string, string | null>;
  regiaoNomeMap: Record<string, string>;
  contagemPorQ: Record<string, number>;
  agentColorMap: Record<string, string>;
  isPending: boolean;
  onAtribuir: (agenteId: string) => void;
  onLimpar: () => void;
  onToggleQuadra: (q: string) => void;
}

export function BarraAtribuicaoSelecionadas({
  selecionadas, agentes, atribuicoes, agentesMap,
  qBairroMap, regiaoNomeMap, contagemPorQ, agentColorMap,
  isPending, onAtribuir, onLimpar, onToggleQuadra,
}: Props) {
  const [agenteId, setAgenteId] = useState('');
  const [tabelaAberta, setTabelaAberta] = useState(true);

  if (selecionadas.size === 0) return null;

  const quadrasSel = [...selecionadas].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const totalImoveis = quadrasSel.reduce((s, q) => s + (contagemPorQ[q] ?? 0), 0);
  const bairrosEnvolvidos = new Set(quadrasSel.map((q) => qBairroMap[q]).filter(Boolean)).size;
  const pendentes = quadrasSel.filter((q) => {
    const st = atribuicoes[q] ?? { salvo: '', pendente: '' };
    return st.pendente !== st.salvo;
  }).length;

  return (
    <div className="flex-shrink-0 border-t bg-card/98 backdrop-blur-sm overflow-hidden shadow-[0_-4px_20px_rgba(0,0,0,0.07)]">
      {/* Command dock */}
      <div className="flex items-center gap-2 px-4 py-2 flex-wrap gap-y-1.5">

        {/* Context chips */}
        <div className="flex items-center gap-1.5 flex-wrap shrink-0">
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-primary bg-primary/10 border border-primary/25 px-2 py-0.5 rounded-full">
            <CheckSquare className="h-3 w-3" />
            {selecionadas.size} quadra{selecionadas.size !== 1 ? 's' : ''}
          </span>
          {totalImoveis > 0 && (
            <span className="inline-flex items-center text-[10px] text-muted-foreground bg-muted/50 border border-border/50 px-2 py-0.5 rounded-full">
              {totalImoveis} imóveis
            </span>
          )}
          {bairrosEnvolvidos > 0 && (
            <span className="inline-flex items-center text-[10px] text-muted-foreground bg-muted/50 border border-border/50 px-2 py-0.5 rounded-full">
              {bairrosEnvolvidos} bairro{bairrosEnvolvidos !== 1 ? 's' : ''}
            </span>
          )}
          {pendentes > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] text-amber-700 bg-amber-100/60 border border-amber-200/70 px-2 py-0.5 rounded-full font-medium">
              <AlertTriangle className="h-2.5 w-2.5" />
              {pendentes} não salva{pendentes !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Separator */}
        <div className="h-5 w-px bg-border/60 hidden sm:block shrink-0" />

        {/* Agent selector + atribuir */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Select value={agenteId} onValueChange={setAgenteId}>
            <SelectTrigger className="w-44 h-7 text-xs shrink-0">
              <SelectValue placeholder="Selecionar agente…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__remove__">— Remover atribuição —</SelectItem>
              {agentes.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            disabled={!agenteId || isPending}
            onClick={() => {
              onAtribuir(agenteId === '__remove__' ? '' : agenteId);
              setAgenteId('');
            }}
            className="gap-1.5 h-7 text-xs shrink-0"
          >
            <UserCheck className="h-3 w-3" />
            Atribuir
          </Button>
        </div>

        {/* Secondary controls */}
        <div className="flex items-center gap-1 ml-auto shrink-0">
          <button
            type="button"
            onClick={() => setTabelaAberta((v) => !v)}
            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-muted/60 transition-colors"
            title={tabelaAberta ? 'Ocultar lista' : 'Mostrar lista'}
          >
            {tabelaAberta
              ? <ChevronDown className="h-3 w-3" />
              : <ChevronUp className="h-3 w-3" />
            }
          </button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onLimpar}
            className="gap-1.5 text-muted-foreground hover:text-destructive h-7 text-xs"
          >
            <X className="h-3 w-3" />
            Limpar
          </Button>
        </div>
      </div>

      {/* Selection manifest — collapsible */}
      {tabelaAberta && (
        <div className="max-h-[140px] overflow-y-auto border-t border-border/50">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-muted/70 backdrop-blur-sm">
              <tr className="text-[9px] text-muted-foreground font-semibold uppercase tracking-widest">
                <th className="w-7 px-2 py-1.5 text-left" />
                <th className="px-2 py-1.5 text-left">Quadra</th>
                <th className="px-2 py-1.5 text-left hidden sm:table-cell">Bairro</th>
                <th className="px-2 py-1.5 text-right hidden md:table-cell">Im.</th>
                <th className="px-2 py-1.5 text-left">Responsável</th>
                <th className="px-2 py-1.5 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {quadrasSel.map((q) => {
                const st = atribuicoes[q] ?? { salvo: '', pendente: '' };
                const alterado = st.pendente !== st.salvo;
                const bairroId = qBairroMap[q] ?? null;
                const rNome = bairroId ? (regiaoNomeMap[bairroId] ?? '—') : '—';
                const nIm = contagemPorQ[q] ?? 0;
                const agNome = st.pendente ? (agentesMap[st.pendente] ?? '?') : null;
                const agColor = st.pendente ? (agentColorMap[st.pendente] ?? '#6b7280') : null;

                return (
                  <tr
                    key={q}
                    className={cn(
                      'hover:bg-muted/20 transition-colors cursor-pointer',
                      alterado && 'bg-amber-50/30 dark:bg-amber-950/10',
                    )}
                    onClick={() => onToggleQuadra(q)}
                  >
                    <td className="px-2 py-1">
                      <CheckSquare className="h-3 w-3 text-primary" />
                    </td>
                    <td className="px-2 py-1 font-mono font-semibold text-[11px]">{q}</td>
                    <td className="px-2 py-1 text-muted-foreground hidden sm:table-cell">
                      <span className="truncate max-w-[100px] block text-[11px]">{rNome}</span>
                    </td>
                    <td className="px-2 py-1 text-right tabular-nums hidden md:table-cell text-[11px] text-muted-foreground">
                      {nIm}
                    </td>
                    <td className="px-2 py-1">
                      {agNome ? (
                        <span className="flex items-center gap-1.5">
                          {agColor && (
                            <span
                              className="h-1.5 w-1.5 rounded-full shrink-0"
                              style={{ backgroundColor: agColor }}
                            />
                          )}
                          <span className={cn(
                            'truncate max-w-[80px] text-[11px]',
                            alterado ? 'text-amber-600' : 'text-emerald-600',
                          )}>
                            {agNome}
                          </span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground/40 text-[11px]">—</span>
                      )}
                    </td>
                    <td className="px-2 py-1 text-right">
                      {alterado ? (
                        <Badge className="text-[9px] bg-amber-500/15 text-amber-700 border-transparent h-4 px-1">
                          pendente
                        </Badge>
                      ) : st.salvo ? (
                        <Badge className="text-[9px] bg-emerald-500/15 text-emerald-700 border-transparent h-4 px-1">
                          salvo
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[9px] text-muted-foreground h-4 px-1">
                          sem agente
                        </Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
