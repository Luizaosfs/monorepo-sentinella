import { useState, useMemo, useEffect, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Map, Loader2, Save, Copy, ChevronDown, ChevronRight, Search,
  Users, AlertTriangle, CheckCircle2, BarChart3,
} from 'lucide-react';
import { useClienteAtivo } from '@/hooks/useClienteAtivo';
import { api } from '@/services/api';
import { useCicloAtivo } from '@/hooks/queries/useCicloAtivo';
import { useImoveis } from '@/hooks/queries/useImoveis';
import {
  useDistribuicaoQuarteiraoByCiclo,
  useCoberturaQuarteirao,
} from '@/hooks/queries/useDistribuicaoQuarteirao';
import AdminPageHeader from '@/components/AdminPageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { useQuery } from '@tanstack/react-query';
import { STALE } from '@/lib/queryConfig';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { DistribuicaoQuarteirao } from '@/types/database';

const CICLOS = [1, 2, 3, 4, 5, 6] as const;
const CICLO_LABELS: Record<number, string> = {
  1: 'Ciclo 1 (Jan–Fev)', 2: 'Ciclo 2 (Mar–Abr)',
  3: 'Ciclo 3 (Mai–Jun)', 4: 'Ciclo 4 (Jul–Ago)',
  5: 'Ciclo 5 (Set–Out)', 6: 'Ciclo 6 (Nov–Dez)',
};
// ── Tipos internos ────────────────────────────────────────────────────────────

/** Estado de uma atribuição: atual (salvo no banco) vs. pendente (alterado na UI) */
interface AtribuicaoState {
  salvo: string;    // agente_id salvo no banco ('' = sem atribuição)
  pendente: string; // agente_id pendente na UI  ('' = sem atribuição)
}

// ── Componente ────────────────────────────────────────────────────────────────

export default function AdminDistribuicaoQuarteirao() {
  const { clienteId } = useClienteAtivo();
  const queryClient = useQueryClient();
  const { cicloNumero } = useCicloAtivo();
  const [ciclo, setCiclo] = useState(() => cicloNumero);
  const [bairrosAbertos, setBairrosAbertos] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');

  /**
   * Mapa quarteirao → { salvo, pendente }
   * Mantém rastreabilidade precisa do que foi alterado mas ainda não salvo.
   */
  const [atribuicoes, setAtribuicoes] = useState<Record<string, AtribuicaoState>>({});

  // ── Dados ─────────────────────────────────────────────────────────────────
  const { data: imoveis = [], isLoading: loadingImoveis } = useImoveis(clienteId);
  const { data: distribuicaoSalva = [], isLoading: loadingDist } =
    useDistribuicaoQuarteiraoByCiclo(clienteId, ciclo);
  const { data: cobertura = [] } = useCoberturaQuarteirao(clienteId, ciclo);

  const { data: agentes = [], isLoading: loadingAgentes } = useQuery({
    queryKey: ['usuarios_agentes', clienteId],
    queryFn: async () => {
      const [usuarios, papeis] = await Promise.all([
        api.usuarios.listByCliente(clienteId ?? null),
        api.usuarios.listPapeis(clienteId ?? null),
      ]);
      let papeisList = papeis ?? [];
      const isAgentePapel = (p: string) => p.toLowerCase() === 'agente';
      const temOp = papeisList.some((p) => isAgentePapel(String(p.papel)));
      if (!temOp) {
        const geral = await api.usuarios.listPapeis().catch(() => []);
        if (geral.length > 0) papeisList = geral;
      }
      const papelPorId: Record<string, string> = {};
      for (const p of papeisList) papelPorId[p.usuario_id] = String(p.papel).toLowerCase();
      return (usuarios ?? []).filter((u) => {
        const porAuthId = u.auth_id ? papelPorId[u.auth_id] : undefined;
        const porId = papelPorId[u.id];
        return isAgentePapel(porAuthId ?? '') || isAgentePapel(porId ?? '');
      });
    },
    enabled: !!clienteId,
    staleTime: STALE.STATIC,
  });

  // ── Derivações ────────────────────────────────────────────────────────────

  /** Contagem de imóveis por quarteirão (apenas ativos) */
  const contagemPorQ = useMemo(() => {
    const c: Record<string, number> = {};
    for (const im of imoveis) {
      if (!im.ativo) continue;
      const q = (im.quarteirao ?? '').trim();
      if (!q) continue;
      c[q] = (c[q] ?? 0) + 1;
    }
    return c;
  }, [imoveis]);

  /** Todos os quarteirões existentes, ordenados */
  const quarteiroes = useMemo(
    () => Object.keys(contagemPorQ).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [contagemPorQ],
  );

  /** Imóveis que não têm quarteirão definido */
  const imoveisSemQuarteirao = useMemo(
    () => imoveis.filter((im) => im.ativo && !im.quarteirao?.trim()),
    [imoveis],
  );

  /** Agrupamento por bairro: bairro → lista de quarteirões */
  const porBairro = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const im of imoveis) {
      if (!im.ativo) continue;
      const q = (im.quarteirao ?? '').trim();
      if (!q) continue;
      const b = (im.bairro ?? 'Sem bairro').trim();
      if (!map[b]) map[b] = [];
      if (!map[b].includes(q)) map[b].push(q);
    }
    // Ordena os quarteirões dentro de cada bairro
    for (const b of Object.keys(map)) {
      map[b].sort((a, c) => a.localeCompare(c, 'pt-BR'));
    }
    return map;
  }, [imoveis]);

  const bairros = useMemo(
    () => Object.keys(porBairro).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [porBairro],
  );

  /** Bairros filtrados por busca (bairro ou número do quarteirão) */
  const bairrosFiltrados = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return bairros;

    return bairros.filter((bairro) => {
      const bairroMatch = bairro.toLowerCase().includes(term);
      if (bairroMatch) return true;
      const qs = porBairro[bairro] ?? [];
      return qs.some((q) => q.toLowerCase().includes(term));
    });
  }, [bairros, porBairro, searchTerm]);

  /** Carga de trabalho por agente: id → { quarteiroes, imoveis } */
  const cargaAgente = useMemo(() => {
    const c: Record<string, { quarteiroes: number; imoveis: number }> = {};
    for (const [q, st] of Object.entries(atribuicoes)) {
      const agenteId = st.pendente || st.salvo;
      if (!agenteId) continue;
      if (!c[agenteId]) c[agenteId] = { quarteiroes: 0, imoveis: 0 };
      c[agenteId].quarteiroes++;
      c[agenteId].imoveis += contagemPorQ[q] ?? 0;
    }
    return c;
  }, [atribuicoes, contagemPorQ]);

  /** Quarteirões com mudança pendente (não salva) */
  const pendentes = useMemo(
    () =>
      Object.entries(atribuicoes)
        .filter(([, st]) => st.pendente !== st.salvo)
        .map(([q]) => q),
    [atribuicoes],
  );

  const temPendentes = pendentes.length > 0;
  const totalDistribuidos = Object.values(atribuicoes).filter((s) => !!s.pendente).length;
  const totalSemAtribuicao = Math.max(quarteiroes.length - totalDistribuidos, 0);
  const pctDistribuido = quarteiroes.length > 0 ? Math.round((totalDistribuidos / quarteiroes.length) * 100) : 0;

  // ── Sincroniza estado local quando dados do banco mudam ──────────────────
  useEffect(() => {
    if (loadingDist) return;
    setAtribuicoes((prev) => {
      const next: Record<string, AtribuicaoState> = {};
      // Inicializa todos os quarteirões conhecidos
      for (const q of quarteiroes) {
        const savedEntry = (distribuicaoSalva as DistribuicaoQuarteirao[]).find(
          (d) => d.quarteirao === q,
        );
        const salvo = savedEntry?.agente_id ?? '';
        // Preserva pendente se já havia alteração local, caso contrário reseta
        const pendente = prev[q]?.pendente !== undefined ? prev[q].pendente : salvo;
        next[q] = { salvo, pendente };
      }
      return next;
    });
    // Abre todos os bairros por padrão na primeira carga
    setBairrosAbertos((prev) => {
      if (prev.size > 0) return prev;
      return new Set(bairros);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [distribuicaoSalva, loadingDist, quarteiroes.join(',')]);

  // ── Ações ─────────────────────────────────────────────────────────────────

  const setAtribuicao = useCallback((quarteirao: string, agenteId: string) => {
    setAtribuicoes((prev) => ({
      ...prev,
      [quarteirao]: { salvo: prev[quarteirao]?.salvo ?? '', pendente: agenteId },
    }));
  }, []);

  /** Atribuição em lote: todos os quarteirões de um bairro → mesmo agente */
  const atribuirBairro = useCallback((bairro: string, agenteId: string) => {
    const qs = porBairro[bairro] ?? [];
    setAtribuicoes((prev) => {
      const next = { ...prev };
      for (const q of qs) {
        next[q] = { salvo: prev[q]?.salvo ?? '', pendente: agenteId };
      }
      return next;
    });
  }, [porBairro]);

  const toggleBairro = (bairro: string) => {
    setBairrosAbertos((prev) => {
      const next = new Set(prev);
      if (next.has(bairro)) next.delete(bairro);
      else next.add(bairro);
      return next;
    });
  };

  const expandirTodos = useCallback(() => {
    setBairrosAbertos(new Set(bairrosFiltrados));
  }, [bairrosFiltrados]);

  const recolherTodos = useCallback(() => {
    setBairrosAbertos(new Set());
  }, []);

  // ── Mutação: salvar ───────────────────────────────────────────────────────
  const salvarMutation = useMutation({
    mutationFn: async () => {
      if (!clienteId) return;

      const toUpsert: Omit<DistribuicaoQuarteirao, 'id' | 'created_at' | 'updated_at'>[] = [];
      const toDelete: string[] = [];

      for (const [quarteirao, st] of Object.entries(atribuicoes)) {
        if (st.pendente === st.salvo) continue; // sem mudança
        if (st.pendente) {
          toUpsert.push({
            cliente_id: clienteId,
            ciclo,
            quarteirao,
            agente_id: st.pendente,
            regiao_id: null,
          });
        } else {
          // agente removido
          toDelete.push(quarteirao);
        }
      }

      await Promise.all([
        api.distribuicaoQuarteirao.upsert(toUpsert),
        api.distribuicaoQuarteirao.deletar(clienteId, ciclo, toDelete),
      ]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dist_quarteirao', clienteId, ciclo] });
      queryClient.invalidateQueries({ queryKey: ['cobertura_quarteirao', clienteId, ciclo] });
      toast.success(`Distribuição salva. ${pendentes.length} quarteirão(ões) atualizado(s).`);
    },
    onError: () => toast.error('Erro ao salvar distribuição.'),
  });

  // ── Mutação: copiar do ciclo anterior ─────────────────────────────────────
  const copiarMutation = useMutation({
    mutationFn: async () => {
      if (!clienteId) return 0;
      const cicloOrigem = ciclo === 1 ? 6 : ciclo - 1;
      return api.distribuicaoQuarteirao.copiarDoCiclo(clienteId, cicloOrigem, ciclo);
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['dist_quarteirao', clienteId, ciclo] });
      if ((count ?? 0) > 0) {
        toast.success(`${count} quarteirão(ões) copiado(s) do ciclo anterior.`);
      } else {
        toast.info('Nenhum quarteirão novo para copiar (já estavam distribuídos ou ciclo anterior vazio).');
      }
    },
    onError: () => toast.error('Erro ao copiar distribuição.'),
  });

  const isLoading = loadingImoveis || loadingDist || loadingAgentes;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-fade-in pb-8">
      <AdminPageHeader
        title="Distribuição de Quarteirões"
        description="Atribua quarteirões a agentes de campo por ciclo"
        icon={Map}
      />

      {/* ── Controles ── */}
      <Card>
        <CardContent className="pt-5 space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
            <div className="space-y-1">
              <Label>Ciclo</Label>
              <Select value={String(ciclo)} onValueChange={(v) => setCiclo(Number(v))}>
                <SelectTrigger className="w-full lg:w-60">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CICLOS.map((c) => (
                    <SelectItem key={c} value={String(c)}>
                      {CICLO_LABELS[c]}
                      {c === cicloNumero && (
                        <span className="ml-2 text-[10px] text-emerald-600 font-semibold">atual</span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1 flex-1">
              <Label>Buscar bairro/quarteirão</Label>
              <div className="relative">
                <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Ex.: Centro ou Q12"
                  className="pl-9"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={expandirTodos}
              disabled={isLoading || bairrosFiltrados.length === 0}
            >
              Expandir todos
            </Button>
            <Button
              variant="outline"
              onClick={recolherTodos}
              disabled={isLoading || bairrosAbertos.size === 0}
            >
              Recolher todos
            </Button>
            <Button
              variant="outline"
              onClick={() => copiarMutation.mutate()}
              disabled={copiarMutation.isPending || isLoading}
              className="gap-2"
              title={`Copia a distribuição do ${CICLO_LABELS[ciclo === 1 ? 6 : ciclo - 1]} para este ciclo`}
            >
              {copiarMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              Copiar do ciclo anterior
            </Button>

            <Button
              onClick={() => salvarMutation.mutate()}
              disabled={salvarMutation.isPending || !temPendentes}
              className="gap-2 ml-auto"
            >
              {salvarMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Salvar{temPendentes ? ` (${pendentes.length})` : ''}
            </Button>
          </div>

          <div className="rounded-lg border bg-muted/20 px-3 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="text-muted-foreground">
                Progresso de distribuição do ciclo
              </span>
              <span className="font-semibold">
                {totalDistribuidos}/{quarteiroes.length} ({pctDistribuido}%)
              </span>
            </div>
            <Progress value={pctDistribuido} className="h-2 mt-2" />
            <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
              <Badge variant="outline">{totalDistribuidos} distribuídos</Badge>
              <Badge variant="outline">{totalSemAtribuicao} sem atribuição</Badge>
              {temPendentes && (
                <Badge className="bg-amber-500/15 text-amber-700 border-transparent">
                  {pendentes.length} pendente(s) de salvar
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Alerta: imóveis sem quarteirão ── */}
      {imoveisSemQuarteirao.length > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>
            <strong>{imoveisSemQuarteirao.length} imóvel(is)</strong> sem quarteirão definido
            — eles não aparecem na distribuição.{' '}
            <a href="/admin/imoveis" className="underline underline-offset-2 hover:text-amber-900">
              Cadastrar quarteirão
            </a>
          </span>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      ) : quarteiroes.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground text-sm">
            Nenhum quarteirão cadastrado nos imóveis deste cliente.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6 items-start">

          {/* ── Lista de quarteirões agrupada por bairro ── */}
          <div className="space-y-3">
            {bairrosFiltrados.map((bairro) => {
              const qs = porBairro[bairro] ?? [];
              const aberto = bairrosAbertos.has(bairro);
              const totalImoveis = qs.reduce((s, q) => s + (contagemPorQ[q] ?? 0), 0);
              const atribuidos = qs.filter((q) => atribuicoes[q]?.pendente).length;
              const todosPendentes = qs.some(
                (q) => atribuicoes[q]?.pendente !== atribuicoes[q]?.salvo,
              );

              return (
                <Card key={bairro} className={cn(todosPendentes && 'border-amber-300')}>
                  {/* Header do bairro */}
                  <div className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/40 rounded-t-xl transition-colors">
                    <button
                      type="button"
                      onClick={() => toggleBairro(bairro)}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    >
                      {aberto ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <span className="font-semibold text-sm">{bairro}</span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="outline" className="text-[10px]">
                            {qs.length} quarteirão(ões)
                          </Badge>
                          <Badge variant="outline" className="text-[10px]">
                            {totalImoveis} imóvel(is)
                          </Badge>
                          {atribuidos === qs.length && qs.length > 0 && (
                            <Badge className="text-[10px] bg-emerald-500/15 text-emerald-700 border-transparent">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Completo
                            </Badge>
                          )}
                          {todosPendentes && (
                            <Badge className="text-[10px] bg-amber-500/15 text-amber-700 border-transparent">
                              Não salvo
                            </Badge>
                          )}
                        </div>
                      </div>
                    </button>

                    {/* Atribuição em lote para o bairro inteiro */}
                    <div className="shrink-0">
                      <Select
                        value="__batch__"
                        onValueChange={(v) => {
                          if (v !== '__batch__') atribuirBairro(bairro, v === '__none__' ? '' : v);
                        }}
                      >
                        <SelectTrigger className="h-7 w-40 text-[11px]">
                          <SelectValue placeholder="Atribuir bairro…" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__batch__" disabled>
                            Atribuir todos…
                          </SelectItem>
                          <SelectItem value="__none__">— Remover todos —</SelectItem>
                          {agentes.map((a) => (
                            <SelectItem key={a.id} value={a.id}>
                              {a.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Linhas de quarteirão */}
                  {aberto && (
                    <div className="divide-y divide-border/40 border-t">
                      {qs.map((q) => {
                        const st = atribuicoes[q] ?? { salvo: '', pendente: '' };
                        const alterado = st.pendente !== st.salvo;
                        const cobQ = cobertura.find((c) => c.quarteirao === q);

                        return (
                          <div
                            key={q}
                            className={cn(
                              'flex items-center gap-3 px-4 py-2.5 transition-colors',
                              alterado && 'bg-amber-50 dark:bg-amber-950/20',
                            )}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-sm">Quarteirão {q}</span>
                                <Badge variant="outline" className="text-[10px]">
                                  {contagemPorQ[q] ?? 0} imóv.
                                </Badge>
                                {alterado && (
                                  <Badge className="text-[10px] bg-amber-500/15 text-amber-700 border-transparent">
                                    pendente
                                  </Badge>
                                )}
                                {!alterado && st.salvo && (
                                  <Badge className="text-[10px] bg-emerald-500/15 text-emerald-700 border-transparent">
                                    salvo
                                  </Badge>
                                )}
                              </div>
                              {/* Cobertura do ciclo */}
                              {cobQ && cobQ.total_imoveis > 0 && (
                                <div className="flex items-center gap-2 mt-1">
                                  <Progress
                                    value={Number(cobQ.pct_cobertura)}
                                    className="h-1.5 w-20"
                                  />
                                  <span className="text-[10px] text-muted-foreground">
                                    {cobQ.visitados}/{cobQ.total_imoveis} ({cobQ.pct_cobertura}%)
                                  </span>
                                </div>
                              )}
                            </div>

                            <Select
                              value={st.pendente || '__none__'}
                              onValueChange={(v) =>
                                setAtribuicao(q, v === '__none__' ? '' : v)
                              }
                            >
                              <SelectTrigger
                                className={cn(
                                  'w-44 h-8 text-xs',
                                  alterado && 'border-amber-400',
                                )}
                              >
                                <SelectValue placeholder="Selecionar agente…" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">— Sem atribuição —</SelectItem>
                                {agentes.map((a) => (
                                  <SelectItem key={a.id} value={a.id}>
                                    {a.nome}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>

          {/* ── Painel de carga por agente ── */}
          <div className="space-y-4 lg:sticky lg:top-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Carga por agente
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {agentes.length === 0 ? (
                  <p className="text-xs text-muted-foreground px-4 pb-4">
                    Nenhum agente cadastrado.
                  </p>
                ) : (
                  <div className="divide-y divide-border/40">
                    {agentes.map((a) => {
                      const carga = cargaAgente[a.id] ?? { quarteiroes: 0, imoveis: 0 };
                      const maxImoveis = Math.max(
                        ...agentes.map(
                          (ag) => cargaAgente[ag.id]?.imoveis ?? 0,
                        ),
                        1,
                      );
                      return (
                        <div key={a.id} className="px-4 py-2.5 space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-medium truncate">{a.nome}</span>
                            <div className="flex gap-1 shrink-0">
                              <Badge variant="outline" className="text-[10px]">
                                {carga.quarteiroes}Q
                              </Badge>
                              <Badge variant="outline" className="text-[10px]">
                                {carga.imoveis}I
                              </Badge>
                            </div>
                          </div>
                          <Progress
                            value={(carga.imoveis / maxImoveis) * 100}
                            className="h-1.5"
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Resumo geral */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Resumo do ciclo
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total de quarteirões</span>
                  <span className="font-semibold">{quarteiroes.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Distribuídos</span>
                  <span className="font-semibold text-emerald-600">
                    {Object.values(atribuicoes).filter((s) => s.pendente).length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sem atribuição</span>
                  <span className="font-semibold text-destructive">
                    {Object.values(atribuicoes).filter((s) => !s.pendente).length}
                  </span>
                </div>
                {temPendentes && (
                  <div className="flex justify-between border-t pt-2 mt-1">
                    <span className="text-amber-600">Alterações pendentes</span>
                    <span className="font-semibold text-amber-600">{pendentes.length}</span>
                  </div>
                )}
                {cobertura.length > 0 && (
                  <>
                    <div className="border-t pt-2 mt-1 text-muted-foreground">Cobertura no ciclo</div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Imóveis visitados</span>
                      <span className="font-semibold">
                        {cobertura.reduce((s, c) => s + Number(c.visitados), 0)}/
                        {cobertura.reduce((s, c) => s + Number(c.total_imoveis), 0)}
                      </span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {!isLoading && bairrosFiltrados.length === 0 && quarteiroes.length > 0 && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Nenhum bairro/quarteirão encontrado para <strong>{searchTerm}</strong>.
          </CardContent>
        </Card>
      )}

      {/* ── Botão salvar sticky (mobile) ── */}
      {temPendentes && (
        <div className="fixed bottom-4 right-4 lg:hidden z-50">
          <Button
            onClick={() => salvarMutation.mutate()}
            disabled={salvarMutation.isPending}
            size="lg"
            className="shadow-lg gap-2"
          >
            {salvarMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Salvar ({pendentes.length})
          </Button>
        </div>
      )}
    </div>
  );
}
