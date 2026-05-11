import { useState, useMemo, useEffect, useCallback } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Map as MapIcon, List, Loader2, Save, Copy, Plus, PenLine, FileJson, Undo2, Users, Grid2X2, AlertTriangle } from 'lucide-react';
import { useClienteAtivo } from '@/hooks/useClienteAtivo';
import { api } from '@/services/api';
import { useCicloAtivo, useHistoricoCiclos, CICLO_LABELS, CICLO_STATUS_COR, CICLO_STATUS_LABEL } from '@/hooks/queries/useCicloAtivo';
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
import type { BairrosDistribuicao } from '@/types/database';

import { DistribuicaoKpiCards } from '@/components/distribuicao/DistribuicaoKpiCards';
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
  const { data: cicloAtivo, cicloNumero } = useCicloAtivo();
  const { data: todosCiclos = [] } = useHistoricoCiclos();

  const [cicloId, setCicloId] = useState<string>(() => cicloAtivo?.id ?? '');
  /** UUID do ciclo aguardando confirmação (troca com pendentes não salvos). */
  const [pendingCicloId, setPendingCicloId] = useState<string | null>(null);

  // Sincroniza cicloId inicial quando cicloAtivo carrega
  useEffect(() => {
    if (cicloAtivo?.id && !cicloId) setCicloId(cicloAtivo.id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cicloAtivo?.id]);
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
    useDistribuicaoQuarteiraoByCiclo(clienteId, cicloId);
  const { data: cobertura = [] } = useCoberturaQuarteirao(clienteId, cicloId);
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

  const cicloSelecionado = useMemo(
    () => todosCiclos.find(c => c.id === cicloId),
    [todosCiclos, cicloId],
  );
  const isCicloFechado = cicloSelecionado?.status === 'fechado';

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

  /** Keyed by UUID (quadra_id) — sem colisão entre bairros com mesmo código. */
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

  /** Array de UUIDs das quadras, ordenados pelo codigo para exibição. */
  const quarteiroes = useMemo(
    () =>
      (quarteiroesMestre as Array<Record<string, unknown>>)
        .filter((q) => q.ativo !== false)
        .sort((a, b) => String(a.codigo).localeCompare(String(b.codigo), 'pt-BR'))
        .map((q) => String(q.id)),
    [quarteiroesMestre],
  );

  /** UUID → bairroId. Keyed by UUID para ser consistente com selecionadas/atribuicoes. */
  const qBairroMap = useMemo(() => {
    const m: Record<string, string | null> = {};
    for (const q of quarteiroesMestre as Array<Record<string, unknown>>) {
      m[String(q.id)] = q.bairro_id ? String(q.bairro_id) : null;
    }
    return m;
  }, [quarteiroesMestre]);

  /** codigo → UUID (para lookup inverso; não usar como chave de estado — usar UUID diretamente). */
  const qIdMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const q of quarteiroesMestre as Array<Record<string, unknown>>) {
      m[String(q.codigo)] = String(q.id);
    }
    return m;
  }, [quarteiroesMestre]);

  /** UUID da quadra → codigo (para sync com distribuicaoSalva) */
  const quadraIdToCode = useMemo(() => {
    const m: Record<string, string> = {};
    for (const q of quarteiroesMestre as Array<Record<string, unknown>>) {
      m[String(q.id)] = String(q.codigo);
    }
    return m;
  }, [quarteiroesMestre]);

  /** UUID → tem geometria (keyed by UUID para consistência com selecionadas). */
  const quarteiraoGeomMap = useMemo<Record<string, boolean>>(() => {
    const m: Record<string, boolean> = {};
    for (const q of quarteiroesMestre as Array<Record<string, unknown>>) {
      if (q.ativo === false) continue;
      const gj = q.geojson as Record<string, unknown> | null | undefined;
      m[String(q.id)] = !!(gj && (gj.type === 'Polygon' || gj.type === 'MultiPolygon'));
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
        bairroId: q.bairro_id ? String(q.bairro_id) : null,
        geojson: q.geojson as Record<string, unknown>,
      }));
  }, [quarteiroesMestre]);

  /** Mapa bairroId → { nome, qs: UUID[] }. qs armazena UUIDs (não codigos) para seleção única. */
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

  /** Polígonos de regiões para camada de fundo do mapa. */
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

  /** Legenda de agentes para o mapa */
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

  // ── Sync local state with server data ─────────────────────────────────────
  useEffect(() => {
    if (loadingDist) return;
    setAtribuicoes((prev) => {
      const next: Record<string, AtribuicaoState> = {};
      for (const q of quarteiroes) {
        const savedEntry = (distribuicaoSalva as BairrosDistribuicao[]).find(
          (d) => d.quadra_id === q,
        );
        const salvo = savedEntry?.agente_id ?? '';
        const pendente = prev[q]?.pendente !== undefined ? prev[q].pendente : salvo;
        next[q] = { salvo, pendente };
      }
      return next;
    });
    setAbertas((prev) => {
      if (prev.size > 0) return prev;
      return new Set(bairroIds);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [distribuicaoSalva, loadingDist, quarteiroes.join(',')]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const setAtribuicao = useCallback((quarteirao: string, agenteId: string) => {
    if (isCicloFechado) return;
    setAtribuicoes((prev) => ({
      ...prev,
      [quarteirao]: { salvo: prev[quarteirao]?.salvo ?? '', pendente: agenteId },
    }));
  }, [isCicloFechado]);

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

  /** Troca de ciclo: pede confirmação se houver pendentes não salvos. */
  const handleCicloChange = useCallback((newId: string) => {
    if (newId === cicloId) return;
    if (temPendentes) {
      setPendingCicloId(newId);
    } else {
      setCicloId(newId);
      setSelecionadas(new Set());
    }
  }, [cicloId, temPendentes]);

  /** Confirma troca de ciclo — descarta pendentes e troca. */
  const confirmarTrocarCiclo = useCallback(() => {
    if (!pendingCicloId) return;
    setCicloId(pendingCicloId);
    setSelecionadas(new Set());
    setAtribuicoes({});
    setPendingCicloId(null);
  }, [pendingCicloId]);

  /** Descarta todas as alterações locais, voltando ao estado salvo. */
  const descartarAlteracoes = useCallback(() => {
    setAtribuicoes((prev) => {
      const next: Record<string, AtribuicaoState> = {};
      for (const [q, st] of Object.entries(prev)) {
        next[q] = { salvo: st.salvo, pendente: st.salvo };
      }
      return next;
    });
    setSelecionadas(new Set());
  }, []);

  /** Abre modal de desenho de nova quadra (do header ou de uma região específica). */
  const handleDesenharNova = useCallback((bairroId?: string) => {
    setModalDesenharRegiaoId(bairroId ?? null);
    setModalDesenharOpen(true);
  }, []);


  const atribuirMutation = useMutation({
    mutationFn: async (agenteId: string) => {
      if (!clienteId || !cicloId || selecionadas.size === 0) return null;
      const ids = [...selecionadas];
      if (agenteId) {
        const rows = ids.map(quadraId => ({
          cicloId,
          quadraId,
          agenteId,
          bairroId: qBairroMap[quadraId] ?? null,
        }));
        await api.distribuicaoQuarteirao.upsert(rows);
      } else {
        await api.distribuicaoQuarteirao.deletar(cicloId, ids);
      }
      return { agenteId, ids };
    },
    onSuccess: (result) => {
      if (!result) return;
      const { agenteId, ids } = result;
      setAtribuicoes((prev) => {
        const next = { ...prev };
        for (const q of ids) {
          next[q] = { salvo: agenteId, pendente: agenteId };
        }
        return next;
      });
      setSelecionadas(new Set());
      queryClient.invalidateQueries({ queryKey: ['dist_quarteirao', clienteId, cicloId] });
      queryClient.invalidateQueries({ queryKey: ['cobertura_quarteirao', clienteId, cicloId] });
      toast.success(`${ids.length} quadra(s) atribuída(s) com sucesso.`);
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

  /** Abre modal de edição/desenho de geometria a partir do painel lateral. Recebe UUID. */
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

  /** Abre modal de edição de geometria a partir do popup do mapa. */
  const handleEditarGeometria = useCallback((q: QuarteiraoParaEdicao) => {
    setModalEditarGeometria(q);
  }, []);

  // ── Mutations ─────────────────────────────────────────────────────────────

  const salvarMutation = useMutation({
    mutationFn: async () => {
      if (!clienteId || !cicloId) return;
      const toUpsert: { cicloId: string; quadraId: string; agenteId: string; bairroId?: string | null }[] = [];
      const toDeleteIds: string[] = [];
      for (const [quadraId, st] of Object.entries(atribuicoes)) {
        if (st.pendente === st.salvo) continue;
        if (st.pendente) {
          toUpsert.push({ cicloId, quadraId, agenteId: st.pendente, bairroId: qBairroMap[quadraId] ?? null });
        } else {
          toDeleteIds.push(quadraId);
        }
      }
      console.debug('[Salvar] toUpsert:', toUpsert, 'toDeleteIds:', toDeleteIds, 'clienteId:', clienteId, 'cicloId:', cicloId);
      if (toUpsert.length === 0 && toDeleteIds.length === 0) {
        toast.info('Nada a salvar — nenhuma alteração pendente detectada.');
        return;
      }
      if (toUpsert.length > 0) await api.distribuicaoQuarteirao.upsert(toUpsert);
      if (toDeleteIds.length > 0) await api.distribuicaoQuarteirao.deletar(cicloId, toDeleteIds);
    },
    onSuccess: () => {
      const count = pendentes.length;
      // Sync local state immediately — don't wait for the background refetch
      setAtribuicoes((prev) => {
        const next: Record<string, AtribuicaoState> = {};
        for (const [q, st] of Object.entries(prev)) {
          next[q] = { salvo: st.pendente, pendente: st.pendente };
        }
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ['dist_quarteirao', clienteId, cicloId] });
      queryClient.invalidateQueries({ queryKey: ['cobertura_quarteirao', clienteId, cicloId] });
      toast.success(`Distribuição salva. ${count} quarteirão(ões) atualizado(s).`);
    },
    onError: () => toast.error('Erro ao salvar distribuição.'),
  });

  const copiarMutation = useMutation({
    mutationFn: async () => {
      if (!clienteId || !cicloId) return 0;
      const cicloSelecionado = todosCiclos.find(c => c.id === cicloId);
      if (!cicloSelecionado) return 0;
      const prevNumero = cicloSelecionado.numero === 1 ? 6 : cicloSelecionado.numero - 1;
      const prevAno    = cicloSelecionado.numero === 1 ? cicloSelecionado.ano - 1 : cicloSelecionado.ano;
      const cicloPrev  = todosCiclos.find(c => c.numero === prevNumero && c.ano === prevAno);
      if (!cicloPrev) { toast.error('Ciclo anterior não encontrado'); return 0; }
      return api.distribuicaoQuarteirao.copiarDoCiclo(clienteId, cicloPrev.id, cicloId);
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['dist_quarteirao', clienteId, cicloId] });
      if ((count ?? 0) > 0) {
        toast.success(`${count} quarteirão(ões) copiado(s) do ciclo anterior.`);
      } else {
        toast.info('Nenhum quarteirão novo para copiar.');
      }
    },
    onError: () => toast.error('Erro ao copiar distribuição.'),
  });

  const isLoading = loadingDist || loadingAgentes || loadingQ || loadingRegioes;

  // Encurta os painéis quando a barra de atribuição está visível para caber na viewport sem scroll
  const distribAreaBox = selecionadas.size > 0
    ? 'h-[calc(100vh-440px)] min-h-[240px]'
    : 'h-[calc(100vh-360px)] min-h-[440px]';

  // ── Stepper de fluxo operacional ──────────────────────────────────────────
  const passosConcluidos = useMemo<StepInfo[]>(() => {
    const temCiclo     = !!cicloId;
    const temTerrit    = regioesList.length > 0;
    const temQs        = quarteiroes.length > 0;
    const geomCompleta = temQs && semGeometria === 0;
    const temDistrib   = totalDistribuidos > 0;
    const distCompleta = temQs && totalSemAtribuicao === 0;

    return [
      {
        label: 'Ciclo',
        status: temCiclo ? 'done' : 'pending',
        detail: temCiclo
          ? (() => { const c = todosCiclos.find(x => x.id === cicloId); return c ? `Ciclo ${c.numero}/${c.ano}` : undefined; })()
          : 'Selecione',
      },
      {
        label: 'Território',
        status: !temCiclo ? 'pending' : temTerrit ? 'done' : 'attention',
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
        status: !temQs ? 'pending' : distCompleta ? 'done' : temDistrib ? 'attention' : 'attention',
        detail: temQs ? `${totalDistribuidos}/${quarteiroes.length} atribuídas` : undefined,
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
    cicloId, todosCiclos, regioesList.length, quarteiroes.length,
    semGeometria, comGeometria, totalDistribuidos, totalSemAtribuicao,
    totalImoveis, totalVisitados,
  ]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4 animate-fade-in -mt-4 lg:-mt-8">
      {/* Header */}
      <AdminPageHeader
        title="Distribuição de Quadras"
        description="Atribuição de quadras aos agentes por ciclo"
        icon={MapIcon}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5">
              <Label className="text-xs shrink-0 hidden sm:block">Ciclo</Label>
              <Select value={cicloId} onValueChange={handleCicloChange} disabled={todosCiclos.length === 0}>
                <SelectTrigger className="w-48 h-8 text-sm">
                  <SelectValue placeholder="Selecione um ciclo" />
                </SelectTrigger>
                <SelectContent>
                  {todosCiclos.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {CICLO_LABELS[c.numero] ?? `Ciclo ${c.numero}`} {c.ano}
                      {c.id === cicloAtivo?.id && (
                        <span className="ml-1 text-[10px] text-emerald-600 font-semibold">atual</span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {cicloSelecionado && (
                <span className={cn(
                  'text-[10px] font-semibold px-1.5 py-0.5 rounded border shrink-0',
                  CICLO_STATUS_COR[cicloSelecionado.status],
                )}>
                  {CICLO_STATUS_LABEL[cicloSelecionado.status]}
                </span>
              )}
            </div>

            {/* Separator: ciclo | territorial ops */}
            <div className="h-6 w-px bg-border/60 hidden sm:block shrink-0" />

            {/* Territorial ops */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDesenharNova()}
              disabled={isCicloFechado}
              className="gap-1.5 h-8"
            >
              <PenLine className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Desenhar</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setModalImportarOpen(true)}
              disabled={isCicloFechado}
              className="gap-1.5 h-8"
            >
              <FileJson className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Importar</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setModalGerarRegiaoId(null); setModalGerarOpen(true); }}
              disabled={isCicloFechado}
              className="gap-1.5 h-8"
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Gerar</span>
            </Button>

            {/* Separator: territorial | distribution ops */}
            <div className="h-6 w-px bg-border/60 hidden sm:block shrink-0" />

            <Button
              variant="outline"
              size="sm"
              onClick={() => copiarMutation.mutate()}
              disabled={copiarMutation.isPending || isLoading || isCicloFechado}
              className="gap-1.5 h-8"
              title="Copiar distribuição do ciclo anterior"
            >
              {copiarMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              <span className="hidden sm:inline">Copiar anterior</span>
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

      {/* Stepper de fluxo operacional */}
      {!isLoading && <FluxoOperacionalStepper steps={passosConcluidos} />}

      {/* 3-panel layout */}
      {isLoading ? (
        <div className="grid grid-cols-1 items-stretch gap-3 lg:grid-cols-[minmax(0,26fr)_minmax(0,58fr)_minmax(0,16fr)]">
          <Skeleton className={cn('rounded-xl', distribAreaBox)} />
          <Skeleton className={cn('rounded-xl', distribAreaBox)} />
          <Skeleton className={cn('rounded-xl', distribAreaBox)} />
        </div>
      ) : !cicloId ? (
        /* Estado vazio — sem ciclo selecionado */
        <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed bg-muted/20 py-20 text-center">
          <div className="rounded-full bg-muted/60 p-4">
            <MapIcon className="h-8 w-8 text-muted-foreground/40" />
          </div>
          <div className="space-y-1.5">
            <p className="text-sm font-semibold">Selecione um ciclo operacional</p>
            <p className="text-xs text-muted-foreground max-w-xs">
              Escolha o ciclo no seletor acima para visualizar e gerenciar a distribuição territorial de quadras.
            </p>
          </div>
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
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setModalGerarRegiaoId(null); setModalGerarOpen(true); }}
              className="gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              Gerar quadras
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDesenharNova()}
              className="gap-1.5"
            >
              <PenLine className="h-3.5 w-3.5" />
              Desenhar quadra
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setModalImportarOpen(true)}
              className="gap-1.5"
            >
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
              onExpandAll={expandAll}
              onCollapseAll={collapseAll}
              highlightQ={highlightEntry}
            />
          </div>

          {/* Center — tabs + mapa/lista (mesma altura dos painéis laterais) */}
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
                  {temPendentes && (
                    <div className="flex shrink-0 items-center justify-between gap-2 border-b border-amber-200/70 bg-amber-50/60 px-3 py-1.5 dark:bg-amber-950/20">
                      <span className="flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        {pendentes.length} alteração(ões) não salva(s)
                      </span>
                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={descartarAlteracoes}
                          disabled={salvarMutation.isPending || isCicloFechado}
                          className="h-7 gap-1 text-xs text-muted-foreground"
                        >
                          <Undo2 className="h-3 w-3" />
                          Descartar
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => salvarMutation.mutate()}
                          disabled={salvarMutation.isPending || isCicloFechado}
                          className="h-7 gap-1 text-xs"
                        >
                          {salvarMutation.isPending ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Save className="h-3 w-3" />
                          )}
                          Salvar ({pendentes.length})
                        </Button>
                      </div>
                    </div>
                  )}
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
                    onSetAtribuicao={setAtribuicao}
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
        isPending={salvarMutation.isPending || atribuirMutation.isPending}
        onAtribuir={atribuirSelecionadas}
        onLimpar={() => { setSelecionadas(new Set()); setHighlightEntry(null); }}
        onToggleQuadra={toggleQuadra}
      />

      {/* Confirmação — troca de ciclo com pendentes não salvos */}
      <Dialog open={!!pendingCicloId} onOpenChange={(open) => { if (!open) setPendingCicloId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Alterações não salvas</DialogTitle>
            <DialogDescription>
              Existem <strong>{pendentes.length}</strong> alteração(ões) não salva(s) neste ciclo.
              Ao trocar de ciclo, essas alterações serão descartadas.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPendingCicloId(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmarTrocarCiclo}>
              Descartar e trocar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
