import { useState, useMemo, useEffect, useCallback } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Map as MapIcon, List, Loader2, Save, Copy, Plus, PenLine, FileJson } from 'lucide-react';
import { useClienteAtivo } from '@/hooks/useClienteAtivo';
import { api } from '@/services/api';
import { useCicloAtivo, CICLO_LABELS } from '@/hooks/queries/useCicloAtivo';
import { useAgentes } from '@/hooks/queries/useAgentes';
import {
  useDistribuicaoQuarteiraoByCiclo,
  useCoberturaQuarteirao,
  useQuarteiroesMestre,
} from '@/hooks/queries/useDistribuicaoQuarteirao';
import AdminPageHeader from '@/components/AdminPageHeader';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { STALE } from '@/lib/queryConfig';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { BairrosDistribuicao } from '@/types/database';

import { DistribuicaoKpiCards } from '@/components/distribuicao/DistribuicaoKpiCards';
import { PainelRegioesQuadras } from '@/components/distribuicao/PainelRegioesQuadras';
import { PainelAgentesDistribuicao } from '@/components/distribuicao/PainelAgentesDistribuicao';
import { ListaQuadrasDistribuicao } from '@/components/distribuicao/ListaQuadrasDistribuicao';
import { BarraAtribuicaoSelecionadas } from '@/components/distribuicao/BarraAtribuicaoSelecionadas';
import { MapaDistribuicao } from '@/components/distribuicao/MapaDistribuicao';
import { buildAgentColorMap } from '@/components/distribuicao/agentColors';
import { ModalGerarLoteQuarteiroes } from '@/components/distribuicao/ModalGerarLoteQuarteiroes';
import { ModalEditarGeometriaQuarteirao } from '@/components/distribuicao/ModalEditarGeometriaQuarteirao';
import { ModalDesenharQuarteirao } from '@/components/quarteiroes/ModalDesenharQuarteirao';
import { ModalImportarGeoJSONQuarteiroes } from '@/components/quarteiroes/ModalImportarGeoJSONQuarteiroes';
import type { AtribuicaoState, Filtro, CoberturaItem, QuarteiraoPolygon, QuarteiraoParaEdicao } from '@/components/distribuicao/types';
import type { RegiaoPolygon } from '@/components/distribuicao/MapaDistribuicao';
import type { RegiaoOpcao } from '@/components/distribuicao/ModalGerarLoteQuarteiroes';
import type { RegiaoParaDesenho } from '@/components/quarteiroes/ModalDesenharQuarteirao';

const CICLOS = [1, 2, 3, 4, 5, 6] as const;
const SEM_REGIAO = '__sem_regiao__';

/** Mesma altura do mapa e dos painéis laterais (viewport menos cabeçalho + KPIs). */
const DISTRIB_AREA_BOX = 'h-[calc(100vh-340px)] min-h-[480px]';

export default function AdminDistribuicaoQuarteirao() {
  const { clienteId } = useClienteAtivo();
  const queryClient = useQueryClient();
  const { cicloNumero } = useCicloAtivo();

  const [ciclo, setCiclo] = useState(() => cicloNumero);
  const [aba, setAba] = useState<'mapa' | 'lista'>('mapa');
  const [abertas, setAbertas] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('todas');
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [atribuicoes, setAtribuicoes] = useState<Record<string, AtribuicaoState>>({});
  const [modalGerarOpen, setModalGerarOpen] = useState(false);
  const [modalGerarRegiaoId, setModalGerarRegiaoId] = useState<string | null>(null);
  const [modalEditarGeometria, setModalEditarGeometria] = useState<QuarteiraoParaEdicao | null>(null);
  const [modalDesenharOpen, setModalDesenharOpen] = useState(false);
  const [modalDesenharRegiaoId, setModalDesenharRegiaoId] = useState<string | null>(null);
  const [modalImportarOpen, setModalImportarOpen] = useState(false);
  /** Quarteirão clicado no mapa — objeto com tick para re-disparar mesmo código repetido */
  const [highlightEntry, setHighlightEntry] = useState<{ codigo: string; tick: number } | null>(null);

  // ── Data ──────────────────────────────────────────────────────────────────
  const { data: distribuicaoSalva = [], isLoading: loadingDist } =
    useDistribuicaoQuarteiraoByCiclo(clienteId, ciclo);
  const { data: cobertura = [] } = useCoberturaQuarteirao(clienteId, ciclo);
  const { data: quarteiroesMestre = [], isLoading: loadingQ } = useQuarteiroesMestre(clienteId);
  const { data: regioesList = [], isLoading: loadingRegioes } = useQuery({
    queryKey: ['regioes', clienteId],
    queryFn: () => api.regioes.listByCliente(clienteId!),
    enabled: !!clienteId,
    staleTime: STALE.LONG,
  });
  const { data: agentes = [], isLoading: loadingAgentes } = useAgentes(clienteId);

  // ── Derived state ─────────────────────────────────────────────────────────

  const agentColorMap = useMemo(
    () => buildAgentColorMap(agentes.map((a) => a.id)),
    [agentes],
  );

  /** Regiões para ModalGerarLote (sem geometria — não precisa). */
  const regioesMapped = useMemo<RegiaoOpcao[]>(
    () =>
      (regioesList as Array<Record<string, unknown>>)
        .filter((r) => r.id)
        .map((r) => ({
          id: String(r.id),
          nome: r.nome ? String(r.nome) : undefined,
          regiao: r.regiao ? String(r.regiao) : undefined,
        })),
    [regioesList],
  );

  /** Regiões completas para ModalDesenhar/EditarGeometria (com geojson como background). */
  const regioesMappedFull = useMemo<RegiaoParaDesenho[]>(
    () =>
      (regioesList as Array<Record<string, unknown>>)
        .filter((r) => r.id)
        .map((r) => ({
          id: String(r.id),
          nome: r.nome ? String(r.nome) : undefined,
          regiao: r.regiao ? String(r.regiao) : undefined,
          geojson: r.geojson ? (r.geojson as Record<string, unknown>) : null,
          latitude: r.latitude ? Number(r.latitude) : null,
          longitude: r.longitude ? Number(r.longitude) : null,
        })),
    [regioesList],
  );

  const contagemPorQ = useMemo(() => {
    const c: Record<string, number> = {};
    for (const row of cobertura as CoberturaItem[]) {
      c[row.quarteirao] = Number(row.total_imoveis);
    }
    return c;
  }, [cobertura]);

  const regiaoNomeMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const r of regioesList as Array<Record<string, unknown>>) {
      if (r.id) m[String(r.id)] = String(r.nome ?? r.regiao ?? 'Sem região');
    }
    return m;
  }, [regioesList]);

  const agentesMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const a of agentes) m[a.id] = a.nome;
    return m;
  }, [agentes]);

  const quarteiroes = useMemo(
    () =>
      (quarteiroesMestre as Array<Record<string, unknown>>)
        .filter((q) => q.ativo !== false)
        .map((q) => String(q.codigo))
        .sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [quarteiroesMestre],
  );

  const qRegiaoMap = useMemo(() => {
    const m: Record<string, string | null> = {};
    for (const q of quarteiroesMestre as Array<Record<string, unknown>>) {
      m[String(q.codigo)] = q.bairro_id ? String(q.bairro_id) : null;
    }
    return m;
  }, [quarteiroesMestre]);

  /** codigo → tem geometria */
  const quarteiraoGeomMap = useMemo<Record<string, boolean>>(() => {
    const m: Record<string, boolean> = {};
    for (const q of quarteiroesMestre as Array<Record<string, unknown>>) {
      if (q.ativo === false) continue;
      const gj = q.geojson as Record<string, unknown> | null | undefined;
      m[String(q.codigo)] = !!(gj && (gj.type === 'Polygon' || gj.type === 'MultiPolygon'));
    }
    return m;
  }, [quarteiroesMestre]);

  /** Quarteirões com geometria — camada principal do mapa. */
  const quarteiraoPolygons = useMemo<QuarteiraoPolygon[]>(() => {
    return (quarteiroesMestre as Array<Record<string, unknown>>)
      .filter((q) => {
        if (q.ativo === false) return false;
        const gj = q.geojson as Record<string, unknown> | null | undefined;
        return gj && (gj.type === 'Polygon' || gj.type === 'MultiPolygon');
      })
      .map((q) => ({
        id: String(q.id),
        codigo: String(q.codigo),
        regiaoId: q.bairro_id ? String(q.bairro_id) : null,
        geojson: q.geojson as Record<string, unknown>,
      }));
  }, [quarteiroesMestre]);

  const porRegiao = useMemo(() => {
    const map = new Map<string, { nome: string; qs: string[] }>();
    for (const r of regioesList as Array<Record<string, unknown>>) {
      const id = String(r.id ?? '');
      if (!id) continue;
      map.set(id, { nome: String(r.nome ?? r.regiao ?? 'Sem região'), qs: [] });
    }
    for (const q of quarteiroesMestre as Array<Record<string, unknown>>) {
      if (q.ativo === false) continue;
      const codigo = String(q.codigo);
      const regiaoId = q.bairro_id ? String(q.bairro_id) : SEM_REGIAO;
      if (!map.has(regiaoId)) {
        map.set(regiaoId, {
          nome: regiaoId === SEM_REGIAO ? 'Sem região' : (regiaoNomeMap[regiaoId] ?? 'Sem região'),
          qs: [],
        });
      }
      const entry = map.get(regiaoId)!;
      if (!entry.qs.includes(codigo)) entry.qs.push(codigo);
    }
    for (const entry of map.values()) {
      entry.qs.sort((a, b) => a.localeCompare(b, 'pt-BR'));
    }
    return map;
  }, [regioesList, quarteiroesMestre, regiaoNomeMap]);

  const regiaoIds = useMemo(
    () =>
      [...porRegiao.keys()].sort((a, b) => {
        if (a === SEM_REGIAO) return 1;
        if (b === SEM_REGIAO) return -1;
        return porRegiao.get(a)!.nome.localeCompare(porRegiao.get(b)!.nome, 'pt-BR');
      }),
    [porRegiao],
  );

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

  /** Polígonos de regiões para camada de fundo do mapa. */
  const regiaoPolygons = useMemo<RegiaoPolygon[]>(() => {
    return (regioesList as Array<Record<string, unknown>>)
      .filter((r) => {
        const gj = r.geojson as Record<string, unknown> | null | undefined;
        return gj && (gj.type === 'Polygon' || gj.type === 'MultiPolygon');
      })
      .map((r) => ({
        regiaoId: String(r.id),
        nome: String(r.nome ?? r.regiao ?? 'Sem região'),
        geojson: r.geojson as Record<string, unknown>,
      }));
  }, [regioesList]);

  const comGeometria = useMemo(
    () => Object.values(quarteiraoGeomMap).filter(Boolean).length,
    [quarteiraoGeomMap],
  );
  const semGeometria = quarteiroes.length - comGeometria;

  /** Legenda de agentes para o mapa */
  const agenteLegenda = useMemo(() => {
    const map: Record<string, { quadras: number; comGeom: number }> = {};
    for (const [codigo, st] of Object.entries(atribuicoes)) {
      const agenteId = st.pendente;
      if (!agenteId) continue;
      if (!map[agenteId]) map[agenteId] = { quadras: 0, comGeom: 0 };
      map[agenteId].quadras++;
      if (quarteiraoGeomMap[codigo]) map[agenteId].comGeom++;
    }
    return agentes.map((a) => ({
      id: a.id,
      nome: a.nome,
      quadras: map[a.id]?.quadras ?? 0,
      comGeom: map[a.id]?.comGeom ?? 0,
    })).filter((a) => a.quadras > 0);
  }, [atribuicoes, agentes, quarteiraoGeomMap]);

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

  const totalImoveis = useMemo(
    () => (cobertura as CoberturaItem[]).reduce((s, c) => s + Number(c.total_imoveis), 0),
    [cobertura],
  );
  const totalVisitados = useMemo(
    () => (cobertura as CoberturaItem[]).reduce((s, c) => s + Number(c.visitados), 0),
    [cobertura],
  );

  const quadrasFiltradas = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return quarteiroes.filter((q) => {
      if (term) {
        const rId = qRegiaoMap[q];
        const rNome = rId ? (regiaoNomeMap[rId] ?? '') : '';
        if (!q.toLowerCase().includes(term) && !rNome.toLowerCase().includes(term)) return false;
      }
      if (filtro === 'atribuidas') return !!atribuicoes[q]?.pendente;
      if (filtro === 'sem_atribuicao') return !atribuicoes[q]?.pendente;
      return true;
    });
  }, [quarteiroes, searchTerm, filtro, atribuicoes, qRegiaoMap, regiaoNomeMap]);

  // ── Sync local state with server data ─────────────────────────────────────
  useEffect(() => {
    if (loadingDist) return;
    setAtribuicoes((prev) => {
      const next: Record<string, AtribuicaoState> = {};
      for (const q of quarteiroes) {
        const savedEntry = (distribuicaoSalva as BairrosDistribuicao[]).find(
          (d) => d.quarteirao === q,
        );
        const salvo = savedEntry?.agente_id ?? '';
        const pendente = prev[q]?.pendente !== undefined ? prev[q].pendente : salvo;
        next[q] = { salvo, pendente };
      }
      return next;
    });
    setAbertas((prev) => {
      if (prev.size > 0) return prev;
      return new Set(regiaoIds);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [distribuicaoSalva, loadingDist, quarteiroes.join(',')]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const setAtribuicao = useCallback((quarteirao: string, agenteId: string) => {
    setAtribuicoes((prev) => ({
      ...prev,
      [quarteirao]: { salvo: prev[quarteirao]?.salvo ?? '', pendente: agenteId },
    }));
  }, []);

  const toggleQuadra = useCallback((q: string) => {
    setSelecionadas((prev) => {
      const next = new Set(prev);
      if (next.has(q)) next.delete(q);
      else next.add(q);
      return next;
    });
  }, []);

  const selectQuadras = useCallback((qs: string[], select: boolean) => {
    setSelecionadas((prev) => {
      const next = new Set(prev);
      for (const q of qs) {
        if (select) next.add(q);
        else next.delete(q);
      }
      return next;
    });
  }, []);

  /** Seleciona/deseleciona um quarteirão a partir do clique no mapa e rola painel. */
  const selectQuarteirao = useCallback((codigo: string, multi: boolean) => {
    setHighlightEntry({ codigo, tick: Date.now() });
    setSelecionadas((prev) => {
      const next = new Set(prev);
      if (multi) {
        if (next.has(codigo)) next.delete(codigo);
        else next.add(codigo);
      } else {
        if (prev.size === 1 && prev.has(codigo)) {
          next.clear();
        } else {
          next.clear();
          next.add(codigo);
        }
      }
      return next;
    });
  }, []);

  /** Abre modal de desenho de nova quadra (do header ou de uma região específica). */
  const handleDesenharNova = useCallback((regiaoId?: string) => {
    setModalDesenharRegiaoId(regiaoId ?? null);
    setModalDesenharOpen(true);
  }, []);


  const atribuirSelecionadas = useCallback(
    (agenteId: string) => {
      setAtribuicoes((prev) => {
        const next = { ...prev };
        for (const q of selecionadas) {
          next[q] = { salvo: prev[q]?.salvo ?? '', pendente: agenteId };
        }
        return next;
      });
      setSelecionadas(new Set());
    },
    [selecionadas],
  );

  const toggleAberta = useCallback((regiaoId: string) => {
    setAbertas((prev) => {
      const next = new Set(prev);
      if (next.has(regiaoId)) next.delete(regiaoId);
      else next.add(regiaoId);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => setAbertas(new Set(regiaoIds)), [regiaoIds]);
  const collapseAll = useCallback(() => setAbertas(new Set()), []);

  const handleGerarQuarteiroes = useCallback((regiaoId: string) => {
    setModalGerarRegiaoId(regiaoId);
    setModalGerarOpen(true);
  }, []);

  /** Abre modal de edição/desenho de geometria a partir do painel lateral. */
  const handleDesenharFromPanel = useCallback((codigo: string, regiaoId: string | null) => {
    const q = (quarteiroesMestre as Array<Record<string, unknown>>).find(
      (m) => String(m.codigo) === codigo,
    );
    if (!q) return;
    setModalEditarGeometria({
      id: String(q.id),
      codigo: String(q.codigo),
      regiaoId,
      geojson: (q.geojson as Record<string, unknown>) ?? null,
    });
  }, [quarteiroesMestre]);

  /** Abre modal de edição de geometria a partir do popup do mapa. */
  const handleEditarGeometria = useCallback((q: QuarteiraoParaEdicao) => {
    setModalEditarGeometria(q);
  }, []);

  // ── Mutations ─────────────────────────────────────────────────────────────

  const salvarMutation = useMutation({
    mutationFn: async () => {
      if (!clienteId) return;
      const toUpsert: { ciclo: number; quarteirao: string; agenteId: string; regiaoId?: string | null }[] = [];
      const toDelete: string[] = [];
      for (const [quarteirao, st] of Object.entries(atribuicoes)) {
        if (st.pendente === st.salvo) continue;
        if (st.pendente) {
          toUpsert.push({ ciclo, quarteirao, agenteId: st.pendente, regiaoId: qRegiaoMap[quarteirao] ?? null });
        } else {
          toDelete.push(quarteirao);
        }
      }
      if (toUpsert.length > 0) await api.distribuicaoQuarteirao.upsert(toUpsert);
      if (toDelete.length > 0) await api.distribuicaoQuarteirao.deletar(ciclo, toDelete);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dist_quarteirao', clienteId, ciclo] });
      queryClient.invalidateQueries({ queryKey: ['cobertura_quarteirao', clienteId, ciclo] });
      toast.success(`Distribuição salva. ${pendentes.length} quarteirão(ões) atualizado(s).`);
    },
    onError: () => toast.error('Erro ao salvar distribuição.'),
  });

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
        toast.info('Nenhum quarteirão novo para copiar.');
      }
    },
    onError: () => toast.error('Erro ao copiar distribuição.'),
  });

  const isLoading = loadingDist || loadingAgentes || loadingQ || loadingRegioes;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className={cn('space-y-4 animate-fade-in', selecionadas.size > 0 && 'pb-80')}>
      {/* Header */}
      <AdminPageHeader
        title="Distribuição de Quadras"
        description="Atribuição de quadras aos agentes por ciclo"
        icon={MapIcon}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5">
              <Label className="text-xs shrink-0 hidden sm:block">Ciclo</Label>
              <Select value={String(ciclo)} onValueChange={(v) => setCiclo(Number(v))}>
                <SelectTrigger className="w-40 h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CICLOS.map((c) => (
                    <SelectItem key={c} value={String(c)}>
                      {CICLO_LABELS[c]}
                      {c === cicloNumero && (
                        <span className="ml-1 text-[10px] text-emerald-600 font-semibold">atual</span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDesenharNova()}
              className="gap-1.5 h-8"
            >
              <PenLine className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Desenhar quadra</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setModalImportarOpen(true)}
              className="gap-1.5 h-8"
            >
              <FileJson className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Importar GeoJSON</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setModalGerarRegiaoId(null); setModalGerarOpen(true); }}
              className="gap-1.5 h-8"
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Gerar quadras</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => copiarMutation.mutate()}
              disabled={copiarMutation.isPending || isLoading}
              className="gap-1.5 h-8"
              title={`Copia do ${CICLO_LABELS[ciclo === 1 ? 6 : ciclo - 1]}`}
            >
              {copiarMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              <span className="hidden sm:inline">Copiar anterior</span>
            </Button>
            <Button
              size="sm"
              onClick={() => salvarMutation.mutate()}
              disabled={salvarMutation.isPending || !temPendentes}
              className="gap-1.5 h-8"
            >
              {salvarMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              Salvar{temPendentes ? ` (${pendentes.length})` : ''}
            </Button>
          </div>
        }
      />

      {/* KPI Cards */}
      <DistribuicaoKpiCards
        totalRegioes={regioesList.length}
        totalQuadras={quarteiroes.length}
        comGeometria={comGeometria}
        semGeometria={semGeometria}
        atribuidos={totalDistribuidos}
        semAtribuicao={totalSemAtribuicao}
        pendentes={pendentes.length}
        totalImoveis={totalImoveis}
        totalVisitados={totalVisitados}
      />

      {/* 3-panel layout */}
      {isLoading ? (
        <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-[320px_1fr_256px]">
          <Skeleton className={cn('rounded-xl', DISTRIB_AREA_BOX)} />
          <Skeleton className={cn('rounded-xl', DISTRIB_AREA_BOX)} />
          <Skeleton className={cn('rounded-xl', DISTRIB_AREA_BOX)} />
        </div>
      ) : (
        <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-[320px_1fr_256px]">
          {/* Left panel */}
          <div className={cn('lg:sticky lg:top-4', DISTRIB_AREA_BOX)}>
            <PainelRegioesQuadras
              porRegiao={porRegiao}
              regiaoIds={regiaoIds}
              atribuicoes={atribuicoes}
              selecionadas={selecionadas}
              abertas={abertas}
              searchTerm={searchTerm}
              filtro={filtro}
              agentesMap={agentesMap}
              agentColorMap={agentColorMap}
              contagemPorQ={contagemPorQ}
              quarteiraoGeomMap={quarteiraoGeomMap}
              onSearchChange={setSearchTerm}
              onFiltroChange={setFiltro}
              onToggleQuadra={toggleQuadra}
              onSelectQuadras={selectQuadras}
              onToggleAberta={toggleAberta}
              onGerarQuarteiroes={handleGerarQuarteiroes}
              onDesenharQuarteirao={handleDesenharFromPanel}
              onDesenharNova={handleDesenharNova}
              onExpandAll={expandAll}
              onCollapseAll={collapseAll}
              highlightQ={highlightEntry}
            />
          </div>

          {/* Center — tabs + mapa/lista (mesma altura dos painéis laterais) */}
          <div className={cn('flex min-h-0 flex-col', DISTRIB_AREA_BOX)}>
            <div className="mb-3 flex shrink-0 gap-1 border-b">
              {([
                { key: 'mapa', label: 'Mapa', Icon: MapIcon },
                { key: 'lista', label: 'Lista', Icon: List },
              ] as const).map(({ key, label, Icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setAba(key)}
                  className={cn(
                    'flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                    aba === key
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>

            <div className="flex min-h-0 flex-1 flex-col">
              {aba === 'mapa' ? (
                <MapaDistribuicao
                  regiaoPolygons={regiaoPolygons}
                  quarteiraoPolygons={quarteiraoPolygons}
                  porRegiao={porRegiao}
                  atribuicoes={atribuicoes}
                  selecionadas={selecionadas}
                  agentColorMap={agentColorMap}
                  agentesMap={agentesMap}
                  regiaoNomeMap={regiaoNomeMap}
                  contagemPorQ={contagemPorQ}
                  agenteLegenda={agenteLegenda}
                  onSelectQuarteirao={selectQuarteirao}
                  onSelectRegiao={selectQuadras}
                  onEditarGeometria={handleEditarGeometria}
                />
              ) : (
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                  <ListaQuadrasDistribuicao
                    quadrasFiltradas={quadrasFiltradas}
                    qRegiaoMap={qRegiaoMap}
                    regiaoNomeMap={regiaoNomeMap}
                    atribuicoes={atribuicoes}
                    agentes={agentes}
                    agentesMap={agentesMap}
                    cobertura={cobertura as CoberturaItem[]}
                    contagemPorQ={contagemPorQ}
                    selecionadas={selecionadas}
                    onToggleQuadra={toggleQuadra}
                    onSetAtribuicao={setAtribuicao}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Right panel */}
          <div className={cn('lg:sticky lg:top-4', DISTRIB_AREA_BOX)}>
            <PainelAgentesDistribuicao
              agentes={agentes}
              cargaAgente={cargaAgente}
              totalQuadras={quarteiroes.length}
              agentColorMap={agentColorMap}
            />
          </div>
        </div>
      )}

      {/* Modals */}
      <ModalGerarLoteQuarteiroes
        open={modalGerarOpen}
        regioes={regioesMapped}
        regiaoIdInicial={modalGerarRegiaoId}
        onClose={() => { setModalGerarOpen(false); setModalGerarRegiaoId(null); }}
      />

      <ModalEditarGeometriaQuarteirao
        open={!!modalEditarGeometria}
        quarteirao={modalEditarGeometria}
        regioes={regioesMappedFull}
        onClose={() => setModalEditarGeometria(null)}
      />

      <ModalDesenharQuarteirao
        open={modalDesenharOpen}
        regioes={regioesMappedFull}
        regiaoIdInicial={modalDesenharRegiaoId}
        onClose={() => { setModalDesenharOpen(false); setModalDesenharRegiaoId(null); }}
        onSalvo={() => {
          queryClient.invalidateQueries({ queryKey: ['quarteiroes_mestre', clienteId] });
        }}
      />

      <ModalImportarGeoJSONQuarteiroes
        open={modalImportarOpen}
        regioes={regioesMappedFull}
        onClose={() => setModalImportarOpen(false)}
        onSalvo={() => {
          queryClient.invalidateQueries({ queryKey: ['quarteiroes_mestre', clienteId] });
        }}
      />

      <BarraAtribuicaoSelecionadas
        selecionadas={selecionadas}
        agentes={agentes}
        atribuicoes={atribuicoes}
        agentesMap={agentesMap}
        qRegiaoMap={qRegiaoMap}
        regiaoNomeMap={regiaoNomeMap}
        contagemPorQ={contagemPorQ}
        agentColorMap={agentColorMap}
        isPending={salvarMutation.isPending}
        onAtribuir={atribuirSelecionadas}
        onLimpar={() => { setSelecionadas(new Set()); setHighlightEntry(null); }}
        onToggleQuadra={toggleQuadra}
      />
    </div>
  );
}
