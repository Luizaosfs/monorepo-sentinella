import { useState } from 'react';
import { UserCheck, X, CheckSquare } from 'lucide-react';
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
  qRegiaoMap: Record<string, string | null>;
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
  qRegiaoMap, regiaoNomeMap, contagemPorQ, agentColorMap,
  isPending, onAtribuir, onLimpar, onToggleQuadra,
}: Props) {
  const [agenteId, setAgenteId] = useState('');

  if (selecionadas.size === 0) return null;

  const quadrasSel = [...selecionadas].sort((a, b) => a.localeCompare(b, 'pt-BR'));

  return (
    <div className="fixed bottom-0 inset-x-0 z-[600] rounded-t-xl border-t border-x bg-card/95 backdrop-blur shadow-lg overflow-hidden">
      {/* Controls */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b bg-muted/30 flex-wrap">
        <span className="text-sm font-semibold text-primary shrink-0">
          {selecionadas.size} quadra(s) selecionada(s)
        </span>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Select value={agenteId} onValueChange={setAgenteId}>
            <SelectTrigger className="w-48 h-8 text-sm shrink-0">
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
            className="gap-1.5 shrink-0"
          >
            <UserCheck className="h-3.5 w-3.5" />
            Atribuir
          </Button>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onLimpar}
          className="gap-1.5 text-muted-foreground shrink-0"
        >
          <X className="h-3.5 w-3.5" />
          Limpar
        </Button>
      </div>

      {/* Table */}
      <div className="max-h-52 overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-muted/50">
            <tr className="text-[10px] text-muted-foreground font-semibold">
              <th className="w-8 px-3 py-1.5 text-left" />
              <th className="px-3 py-1.5 text-left">Quadra</th>
              <th className="px-3 py-1.5 text-left hidden sm:table-cell">Região</th>
              <th className="px-3 py-1.5 text-right hidden md:table-cell">Imóveis</th>
              <th className="px-3 py-1.5 text-left">Responsável</th>
              <th className="px-3 py-1.5 text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {quadrasSel.map((q) => {
              const st = atribuicoes[q] ?? { salvo: '', pendente: '' };
              const alterado = st.pendente !== st.salvo;
              const regiaoId = qRegiaoMap[q] ?? null;
              const rNome = regiaoId ? (regiaoNomeMap[regiaoId] ?? '—') : '—';
              const nIm = contagemPorQ[q] ?? 0;
              const agNome = st.pendente ? (agentesMap[st.pendente] ?? '?') : null;
              const agColor = st.pendente ? (agentColorMap[st.pendente] ?? '#6b7280') : null;

              return (
                <tr
                  key={q}
                  className={cn(
                    'hover:bg-muted/20 transition-colors cursor-pointer',
                    alterado && 'bg-amber-50/40 dark:bg-amber-950/10',
                  )}
                  onClick={() => onToggleQuadra(q)}
                >
                  <td className="px-3 py-1.5">
                    <CheckSquare className="h-3.5 w-3.5 text-primary" />
                  </td>
                  <td className="px-3 py-1.5 font-mono font-semibold">{q}</td>
                  <td className="px-3 py-1.5 text-muted-foreground hidden sm:table-cell">
                    <span className="truncate max-w-[120px] block">{rNome}</span>
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums hidden md:table-cell">{nIm}</td>
                  <td className="px-3 py-1.5">
                    {agNome ? (
                      <span className="flex items-center gap-1.5">
                        {agColor && (
                          <span
                            className="h-2 w-2 rounded-full shrink-0"
                            style={{ backgroundColor: agColor }}
                          />
                        )}
                        <span
                          className={cn(
                            'truncate max-w-[96px]',
                            alterado ? 'text-amber-600' : 'text-emerald-600',
                          )}
                        >
                          {agNome}
                        </span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground/50">—</span>
                    )}
                  </td>
                  <td className="px-3 py-1.5 text-right">
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
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
