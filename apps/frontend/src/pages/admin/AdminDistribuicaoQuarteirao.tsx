import { useState, useMemo, useEffect, useCallback } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Map as MapIcon, List, Loader2, Plus, PenLine, FileJson, Users, Grid2X2, AlertTriangle } from 'lucide-react';
import { useClienteAtivo } from '@/hooks/useClienteAtivo';
import { api } from '@/services/api';
import { useAgentes } from '@/hooks/queries/useAgentes';
import {
  useCoberturaQuarteirao,
  useQuarteiroesMestre,
} from '@/hooks/queries/useDistribuicaoQuarteirao';
import { useDistribuicaoTerritorial } from '@/hooks/queries/useDistribuicaoTerritorial';
import AdminPageHeader from '@/components/AdminPageHeader';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { STALE } from '@/lib/queryConfig';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

import { TerritorialKpiCards } from '@/components/distribuicao/TerritorialKpiCards';
import { FluxoOperacionalStepper } from '@/components/distribuicao/FluxoOperacionalStepper';
import type { StepInfo } from '@/components/distribuicao/FluxoOperacionalStepper';
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

const SEM_REGIAO = '__sem_regiao__';

export default function AdminDistribuicaoQuarteirao() {
  const { clienteId } = useClienteAtivo();
  const queryClient = useQueryClient();

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
  const [highlightEntry, setHighlightEntry] = useState<{ codigo: string; tick: number } | null>(null);
  const [confirmarDeletarBairro, setConfirmarDeletarBairro] = useState<string | null>(null);

  // ── Data ─────────────────────────────────────────────────────────────────
  const { data: distribuicaoTerritorial = [], isLoading: loadingTerritorial } =
    useDistribuicaoTerritorial(clienteId);
  const { data: cobertura = [] } = useCoberturaQuarteirao(clienteId, '');
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

  const regioesMappedFull = useMemo<RegiaoParaDesenho[]>(
    () =>
      (regioesList as Array<Record<string, unknown>>)
        .filter((r) => r.id)
        .map((r) => {
          let geojson: Record<string, unknown> | null = null;
          if (r.geojson) {
            if (typeof r.geojson === 'string') {
              try { geojson = JSON.parse(r.geojson); } catch { geojson = null; }
            } else {
              geojson = r.geojson as Record<string, unknown>;
            }
          }
          return {
            id: String(r.id),
            nome: r.nome ? String(r.nome) : undefined,
            regiao: r.regiao ? String(r.regiao) : undefined,
            geojson,
            latitude: r.latitude ? Number(r.latitude) : null,
            longitude: r.longitude ? Number(r.longitude) : null,
          };
        }),
    [regioesList],
  );

  const contagemPorQ = useMemo(() => {
    const c: Record<string, number> = {};
    for (const row of cobertura as CoberturaItem[]) {
      if (row.quadra_id) c[row.quadra_id] = Number(row.total_imoveis);
    }
    return c;
  }, [cobertura]);

  const coberturaMap = useMemo(() => {
    const c: Record<string, number> = {};
    for (const row of cobertura as CoberturaItem[]) {
      if (row.quadra_id) c[row.quadra_id] = Math.round(Number(row.pct_cobertura));
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
        .sort((a, b) => String(a.codigo).localeCompare(String(b.codigo), 'pt-BR'))
        .map((q) => String(q.id)),
    [quarteiroesMestre],
  );

  const qBairroMap = useMemo(() => {
    const m: Record<string, string | null> = {};
    for (const q of quarteiroesMestre as Array<Record<string, unknown>>) {
      m[String(q.id)] = q.bairro_id ? String(q.bairro_id) : null;
    }
    return m;
  }, [quarteiroesMestre]);

  const quadraIdToCode = useMemo(() => {
    const m: Record<string, string> = {};
    for (const q of quarteiroesMestre as Array<Record<string, unknown>>) {
      m[String(q.id)] = String(q.codigo);
    }
    return m;
  }, [quarteiroesMestre]);

  const quarteiraoGeomMap = useMemo<Record<string, boolean>>(() => {
    const m: Record<string, boolean> = {};
    for (const q of quarteiroesMestre as Array<Record<string, unknown>>) {
      if (q.ativo === false) continue;
      const gj = q.geojson as Record<string, unknown> | null | undefined;
      m[String(q.id)] = !!(gj && (gj.type === 'Polygon' || gj.type === 'MultiPolygon'));
    }
    return m;
  }, [quarteiroesMestre]);

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
        bairroId: q.bairro_id ? String(q.bairro_id) : null,
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
      const uuid = String(q.id);
      const bairroId = q.bairro_id ? String(q.bairro_id) : SEM_REGIAO;
      if (!map.has(bairroId)) {
        map.set(bairroId, {
          nome: bairroId === SEM_REGIAO ? 'Sem região' : (regiaoNomeMap[bairroId] ?? 'Sem região'),
          qs: [],
        });
      }
      const entry = map.get(bairroId)!;
      if (!entry.qs.includes(uuid)) entry.qs.push(uuid);
    }
    for (const entry of map.values()) {
      entry.qs.sort((a, b) => {
        const cA = quadraIdToCode[a] ?? a;
        const cB = quadraIdToCode[b] ?? b;
        return cA.localeCompare(cB, 'pt-BR');
      });
    }
    return map;
  }, [regioesList, quarteiroesMestre, regiaoNomeMap, quadraIdToCode]);

  const bairroIds = useMemo(
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

  const regiaoPolygons = useMemo<RegiaoPolygon[]>(() => {
    return (regioesList as Array<Record<string, unknown>>)
      .filter((r) => {
        const gj = r.geojson as Record<string, unknown> | null | undefined;
        return gj && (gj.type === 'Polygon' || gj.type === 'MultiPolygon');
      })
      .map((r) => ({
        bairroId: String(r.id),
        nome: String(r.nome ?? r.regiao ?? 'Sem região'),
        geojson: r.geojson as Record<string, unknown>,
      }));
  }, [regioesList]);

  const comGeometria = useMemo(
    () => Object.values(quarteiraoGeomMap).filter(Boolean).length,
    [quarteiraoGeomMap],
  );
  const semGeometria = quarteiroes.length - comGeometria;

  const totalImoveis = useMemo(
    () => (cobertura as CoberturaItem[]).reduce((s, c) => s + Number(c.total_imoveis), 0),
    [cobertura],
  );
  const totalVisitados = useMemo(
    () => (cobertura as CoberturaItem[]).reduce((s, c) => s + Number(c.visitados), 0),
    [cobertura],
  );

  const agenteLegenda = useMemo(() => {
    const map: Record<string, { quadras: number; comGeom: number }> = {};
    for (const [uuid, st] of Object.entries(atribuicoes)) {
      const agenteId = st.pendente;
      if (!agenteId) continue;
      if (!map[agenteId]) map[agenteId] = { quadras: 0, comGeom: 0 };
      map[agenteId].quadras++;
      if (quarteiraoGeomMap[uuid]) map[agenteId].comGeom++;
    }
    return agentes.map((a) => ({
      id: a.id,
      nome: a.nome,
      quadras: map[a.id]?.quadras ?? 0,
      comGeom: map[a.id]?.comGeom ?? 0,
    })).filter((a) => a.quadras > 0);
  }, [atribuicoes, agentes, quarteiraoGeomMap]);

  // ── Territorial KPIs ──────────────────────────────────────────────────────
  const territorialAtribuidas = distribuicaoTerritorial.length;
  const territorialSemResponsavel = Math.max(quarteiroes.length - territorialAtribuidas, 0);
  const territorialAgentesAtivos = useMemo(
    () => new Set(distribuicaoTerritorial.map(d => d.agenteId)).size,
    [distribuicaoTerritorial],
  );
  const territorialMediaQuadras = territorialAgentesAtivos > 0
    ? Math.round((territorialAtribuidas / territorialAgentesAtivos) * 10) / 10
    : 0;

  const quadrasFiltradas = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return quarteiroes.filter((q) => {
      if (term) {
        const codigo = quadraIdToCode[q] ?? '';
        const rId = qBairroMap[q];
        const rNome = rId ? (regiaoNomeMap[rId] ?? '') : '';
        if (!codigo.toLowerCase().includes(term) && !rNome.toLowerCase().includes(term)) return false;
      }
      if (filtro === 'atribuidas') return !!atribuicoes[q]?.pendente;
      if (filtro === 'sem_atribuicao') return !atribuicoes[q]?.pendente;
      return true;
    });
  }, [quarteiroes, searchTerm, filtro, atribuicoes, qBairroMap, regiaoNomeMap, quadraIdToCode]);

  // ── Sync local state — territorial ────────────────────────────────────────
  useEffect(() => {
    if (loadingTerritorial || loadingQ) return;
    setAtribuicoes(() => {
      const next: Record<string, AtribuicaoState> = {};
      for (const q of quarteiroes) {
        const terr = distribuicaoTerritorial.find(d => d.quadraId === q);
        const agente = terr?.agenteId ?? '';
        next[q] = { salvo: agente, pendente: agente };
      }
      return next;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [distribuicaoTerritorial, loadingTerritorial, quarteiroes.join(',')]);

  // ── Actions ───────────────────────────────────────────────────────────────

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

  const handleDesenharNova = useCallback((bairroId?: string) => {
    setModalDesenharRegiaoId(bairroId ?? null);
    setModalDesenharOpen(true);
  }, []);

  // ── Mutation: atribuir territorial ────────────────────────────────────────
  const atribuirMutation = useMutation({
    mutationFn: async (agenteId: string) => {
      if (!clienteId || selecionadas.size === 0) return null;
      const ids = [...selecionadas];
      if (agenteId) {
        await Promise.all(ids.map(quadraId =>
          api.distribuicaoQuarteirao.atribuirTerritorial(quadraId, agenteId),
        ));
      } else {
        await Promise.all(ids.map(quadraId =>
          api.distribuicaoQuarteirao.desatribuirTerritorial(quadraId),
        ));
      }
      return { agenteId, ids };
    },
    onSuccess: (result) => {
      if (!result) return;
      const { agenteId, ids } = result;
      queryClient.invalidateQueries({ queryKey: ['distribuicao_territorial', clienteId] });
      setSelecionadas(new Set());
      toast.success(
        `${ids.length} quadra(s) ${agenteId ? 'atribuída(s)' : 'desatribuída(s)'} com sucesso.`,
      );
    },
    onError: () => toast.error('Erro ao atribuir quadras.'),
  });

  const atribuirSelecionadas = useCallback(
    (agenteId: string) => atribuirMutation.mutate(agenteId),
    [atribuirMutation],
  );

  const toggleAberta = useCallback((bairroId: string) => {
    setAbertas((prev) => {
      const next = new Set(prev);
      if (next.has(bairroId)) next.delete(bairroId);
      else next.add(bairroId);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => setAbertas(new Set(bairroIds)), [bairroIds]);
  const collapseAll = useCallback(() => setAbertas(new Set()), []);

  const handleGerarQuarteiroes = useCallback((bairroId: string) => {
    setModalGerarRegiaoId(bairroId);
    setModalGerarOpen(true);
  }, []);

  const handleDesenharFromPanel = useCallback((uuid: string, bairroId: string | null) => {
    const q = (quarteiroesMestre as Array<Record<string, unknown>>).find(
      (m) => String(m.id) === uuid,
    );
    if (!q) return;
    setModalEditarGeometria({
      id: String(q.id),
      codigo: String(q.codigo),
      bairroId,
      geojson: (q.geojson as Record<string, unknown>) ?? null,
    });
  }, [quarteiroesMestre]);

  const handleEditarGeometria = useCallback((q: QuarteiraoParaEdicao) => {
    setModalEditarGeometria(q);
  }, []);

  const deletarBairroMutation = useMutation({
    mutationFn: async (bairroId: string) => {
      return api.quarteiroes.deletarQuadrasBairro(bairroId);
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['quarteiroes_mestre', clienteId] });
      toast.success(`${result.deletadas} quadra(s) removida(s) do bairro.`);
      setConfirmarDeletarBairro(null);
    },
    onError: () => {
      toast.error('Não foi possível excluir — verifique se há distribuições registradas.');
      setConfirmarDeletarBairro(null);
    },
  });

  const passosConcluidos = useMemo<StepInfo[]>(() => {
    const temTerrit    = regioesList.length > 0;
    const temQs        = quarteiroes.length > 0;
    const geomCompleta = temQs && semGeometria === 0;
    const temDistrib   = territorialAtribuidas > 0;
    const distCompleta = temQs && territorialSemResponsavel === 0;

    return [
      {
        label: 'Território',
        status: temTerrit ? 'done' : 'attention',
        detail: temTerrit ? `${regioesList.length} bairro(s)` : 'Sem bairros',
      },
      {
        label: 'Quadras',
        status: !temTerrit ? 'pending' : temQs ? 'done' : 'attention',
        detail: temQs ? `${quarteiroes.length} quadra(s)` : 'Nenhuma',
      },
      {
        label: 'Geometria',
        status: !temQs ? 'pending' : geomCompleta ? 'done' : 'attention',
        detail: temQs ? `${comGeometria}/${quarteiroes.length} c/ mapa` : undefined,
      },
      {
        label: 'Distribuição',
        status: !temQs ? 'pending' : distCompleta ? 'done' : 'attention',
        detail: temQs ? `${territorialAtribuidas}/${quarteiroes.length} atribuídas` : undefined,
      },
      {
        label: 'Cobertura',
        status: !temDistrib ? 'pending' : totalImoveis > 0 ? 'done' : 'attention',
        detail: totalImoveis > 0
          ? `${Math.round((totalVisitados / totalImoveis) * 100)}% visitados`
          : 'Sem imóveis',
      },
    ];
  }, [
    regioesList.length, quarteiroes.length, semGeometria, comGeometria,
    territorialAtribuidas, territorialSemResponsavel, totalImoveis, totalVisitados,
  ]);

  const isLoading = loadingTerritorial || loadingAgentes || loadingQ || loadingRegioes;

  const distribAreaBox = selecionadas.size > 0
    ? 'h-[calc(100vh-440px)] min-h-[240px]'
    : 'h-[calc(100vh-360px)] min-h-[440px]';

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4 animate-fade-in -mt-4 lg:-mt-8">
      {/* Header */}
      <AdminPageHeader
        title="Distribuição de Quadras"
        description="Atribuição territorial permanente — independente de ciclo"
        icon={MapIcon}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDesenharNova()}
              className="gap-1.5 h-8"
            >
              <PenLine className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Desenhar</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setModalImportarOpen(true)}
              className="gap-1.5 h-8"
            >
              <FileJson className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Importar</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setModalGerarRegiaoId(null); setModalGerarOpen(true); }}
              className="gap-1.5 h-8"
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Gerar</span>
            </Button>
          </div>
        }
      />

      {/* KPI Cards */}
      <TerritorialKpiCards
        totalRegioes={regioesList.length}
        totalQuadras={quarteiroes.length}
        atribuidas={territorialAtribuidas}
        semResponsavel={territorialSemResponsavel}
        agentesAtivos={territorialAgentesAtivos}
        mediaQuadrasAgente={territorialMediaQuadras}
      />

      {/* Stepper territorial */}
      {!isLoading && <FluxoOperacionalStepper steps={passosConcluidos} />}

      {/* 3-panel layout */}
      {isLoading ? (
        <div className="grid grid-cols-1 items-stretch gap-3 lg:grid-cols-[minmax(0,26fr)_minmax(0,58fr)_minmax(0,16fr)]">
          <Skeleton className={cn('rounded-xl', distribAreaBox)} />
          <Skeleton className={cn('rounded-xl', distribAreaBox)} />
          <Skeleton className={cn('rounded-xl', distribAreaBox)} />
        </div>
      ) : quarteiroes.length === 0 ? (
        /* Estado vazio — sem quadras cadastradas */
        <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed bg-muted/20 py-20 text-center">
          <div className="rounded-full bg-muted/60 p-4">
            <Grid2X2 className="h-8 w-8 text-muted-foreground/40" />
          </div>
          <div className="space-y-1.5">
            <p className="text-sm font-semibold">Nenhuma quadra cadastrada</p>
            <p className="text-xs text-muted-foreground max-w-sm">
              Gere quadras automaticamente por bairro, desenhe manualmente ou importe um arquivo GeoJSON.
            </p>
          </div>
          <div className="flex gap-2 flex-wrap justify-center">
            <Button variant="outline" size="sm"
              onClick={() => { setModalGerarRegiaoId(null); setModalGerarOpen(true); }}
              className="gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              Gerar quadras
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleDesenharNova()} className="gap-1.5">
              <PenLine className="h-3.5 w-3.5" />
              Desenhar quadra
            </Button>
            <Button variant="outline" size="sm" onClick={() => setModalImportarOpen(true)} className="gap-1.5">
              <FileJson className="h-3.5 w-3.5" />
              Importar GeoJSON
            </Button>
          </div>
        </div>
      ) : agentes.length === 0 ? (
        /* Estado vazio — sem agentes */
        <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed bg-muted/20 py-20 text-center">
          <div className="rounded-full bg-muted/60 p-4">
            <Users className="h-8 w-8 text-muted-foreground/40" />
          </div>
          <div className="space-y-1.5">
            <p className="text-sm font-semibold">Nenhum agente disponível</p>
            <p className="text-xs text-muted-foreground max-w-xs">
              Cadastre agentes de campo no módulo de usuários para poder distribuir quadras.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 items-stretch gap-3 lg:grid-cols-[minmax(0,26fr)_minmax(0,58fr)_minmax(0,16fr)]">
          {/* Left panel */}
          <div className={cn('lg:sticky lg:top-4', distribAreaBox)}>
            <PainelRegioesQuadras
              porRegiao={porRegiao}
              bairroIds={bairroIds}
              atribuicoes={atribuicoes}
              selecionadas={selecionadas}
              abertas={abertas}
              searchTerm={searchTerm}
              filtro={filtro}
              agentesMap={agentesMap}
              agentColorMap={agentColorMap}
              contagemPorQ={contagemPorQ}
              quarteiraoGeomMap={quarteiraoGeomMap}
              uuidToCode={quadraIdToCode}
              onSearchChange={setSearchTerm}
              onFiltroChange={setFiltro}
              onToggleQuadra={toggleQuadra}
              onSelectQuadras={selectQuadras}
              onToggleAberta={toggleAberta}
              onGerarQuarteiroes={handleGerarQuarteiroes}
              onDesenharQuarteirao={handleDesenharFromPanel}
              onDesenharNova={handleDesenharNova}
              onDeletarBairro={setConfirmarDeletarBairro}
              onExpandAll={expandAll}
              onCollapseAll={collapseAll}
              highlightQ={highlightEntry}
            />
          </div>

          {/* Center */}
          <div className={cn('flex min-h-0 flex-col', distribAreaBox)}>
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

              {territorialSemResponsavel > 0 && (
                <span className="ml-auto self-center inline-flex items-center gap-1 text-[10px] font-semibold text-red-600 bg-red-50 border border-red-200/70 px-2 py-0.5 rounded-full">
                  <AlertTriangle className="h-3 w-3" />
                  {territorialSemResponsavel} sem responsável
                </span>
              )}
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
                  cobertura={coberturaMap}
                  agenteLegenda={agenteLegenda}
                  onSelectQuarteirao={selectQuarteirao}
                  onSelectRegiao={selectQuadras}
                  onEditarGeometria={handleEditarGeometria}
                />
              ) : (
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                  <ListaQuadrasDistribuicao
                    quadrasFiltradas={quadrasFiltradas}
                    qBairroMap={qBairroMap}
                    regiaoNomeMap={regiaoNomeMap}
                    atribuicoes={atribuicoes}
                    agentes={agentes}
                    agentesMap={agentesMap}
                    agentColorMap={agentColorMap}
                    cobertura={cobertura as CoberturaItem[]}
                    contagemPorQ={contagemPorQ}
                    selecionadas={selecionadas}
                    uuidToCode={quadraIdToCode}
                    onToggleQuadra={toggleQuadra}
                    onSetAtribuicao={() => {}}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Right panel */}
          <div className={cn('lg:sticky lg:top-4', distribAreaBox)}>
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
        bairroIdInicial={modalGerarRegiaoId}
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
        bairroIdInicial={modalDesenharRegiaoId}
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
        qBairroMap={qBairroMap}
        regiaoNomeMap={regiaoNomeMap}
        contagemPorQ={contagemPorQ}
        agentColorMap={agentColorMap}
        uuidToCode={quadraIdToCode}
        isPending={atribuirMutation.isPending}
        onAtribuir={atribuirSelecionadas}
        onLimpar={() => { setSelecionadas(new Set()); setHighlightEntry(null); }}
        onToggleQuadra={toggleQuadra}
      />

      {/* Confirmação — excluir quadras do bairro */}
      <Dialog open={!!confirmarDeletarBairro} onOpenChange={(open) => { if (!open) setConfirmarDeletarBairro(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Excluir quadras do bairro</DialogTitle>
            <DialogDescription>
              Todas as quadras deste bairro serão removidas permanentemente. Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmarDeletarBairro(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={deletarBairroMutation.isPending}
              onClick={() => confirmarDeletarBairro && deletarBairroMutation.mutate(confirmarDeletarBairro)}
            >
              {deletarBairroMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Excluir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
