import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/services/api";
import { useClienteAtivo } from "@/hooks/useClienteAtivo";
import { useAuth } from "@/hooks/useAuth";
import { LevantamentoItem, FocoRiscoAtivo } from "@/types/database";
import { Loader2, Filter, Route, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { MapToolbar } from "@/components/map-v3/MapToolbar";
import { MapFiltersPanel } from "@/components/map-v3/MapFiltersPanel";
import { LeafletMapView } from "@/components/map-v3/LeafletMapView";
import { ItemDetailsPanel } from "@/components/map-v3/ItemDetailsPanel";
import { ImageModal } from "@/components/map-v3/ImageModal";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useItensAgente } from "@/hooks/queries/useItensAgente";
import { useFocosAtribuidos } from "@/hooks/queries/useFocosAtribuidos";

const PRIORIDADE_RISCO: Record<string, string> = {
  P1: 'critico', P2: 'alto', P3: 'medio', P4: 'baixo', P5: 'baixo',
};

function focoToItem(foco: FocoRiscoAtivo): LevantamentoItem {
  return {
    id: foco.id,
    cliente_id: foco.cliente_id,
    levantamento_id: '',
    latitude: foco.latitude ?? null,
    longitude: foco.longitude ?? null,
    risco: PRIORIDADE_RISCO[foco.prioridade ?? 'P3'] ?? 'medio',
    item: foco.classificacao_inicial ?? foco.origem_tipo ?? 'Foco de risco',
    endereco_normalizado: foco.endereco_normalizado ?? null,
    image_url: (foco as FocoRiscoAtivo & { origem_image_url?: string }).origem_image_url ?? null,
  } as LevantamentoItem;
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function nearestNeighbor(items: LevantamentoItem[]): LevantamentoItem[] {
  const pool = items.filter((i) => i.latitude != null && i.longitude != null);
  if (pool.length === 0) return [];
  const visited = new Set<string>();
  const result: LevantamentoItem[] = [];
  let current = pool[0];
  visited.add(current.id);
  result.push(current);
  while (result.length < pool.length) {
    let nearest: LevantamentoItem | null = null;
    let minDist = Infinity;
    for (const item of pool) {
      if (visited.has(item.id)) continue;
      const d = haversine(current.latitude!, current.longitude!, item.latitude!, item.longitude!);
      if (d < minDist) {
        minDist = d;
        nearest = item;
      }
    }
    if (!nearest) break;
    visited.add(nearest.id);
    result.push(nearest);
    current = nearest;
  }
  return result;
}

/** Mapa exclusivo do operador: apenas itens ligados a operações onde ele é o responsável. */
/** Item convertido de foco_risco tem levantamento_id vazio — usado para distinguir tipo. */
function isFocoRiscoItem(item: LevantamentoItem) {
  return item.levantamento_id === '';
}

export default function AgenteMapa() {
  const navigate = useNavigate();
  const { clienteId, clienteAtivo } = useClienteAtivo();
  const { usuario } = useAuth();
  const { data: itens = [], isLoading, refetch } = useItensAgente(clienteId, usuario?.id ?? null);
  const { data: focosAtribuidos = [] } = useFocosAtribuidos(clienteId, usuario?.id ?? null);
  const focosComoItens = useMemo(
    () => focosAtribuidos.filter((f) => f.latitude != null || f.longitude != null).map(focoToItem),
    [focosAtribuidos],
  );
  const todosItens = useMemo(
    () => [...itens, ...focosComoItens],
    [itens, focosComoItens],
  );

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [panelVisible, setPanelVisible] = useState(true);
  const [filterRisk, setFilterRisk] = useState<string[]>([]);
  const [filterType, setFilterType] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<string>("30d");
  const [selectedItem, setSelectedItem] = useState<LevantamentoItem | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const uniqueTypes = useMemo(() => {
    const s = new Set<string>();
    todosItens.forEach((i) => i.item && s.add(i.item.toLowerCase()));
    return Array.from(s).sort();
  }, [todosItens]);

  const filteredItems = useMemo(() => {
    return todosItens.filter((i) => {
      if (filterRisk.length > 0 && (!i.risco || !filterRisk.includes(i.risco.toLowerCase()))) return false;
      if (filterType.length > 0 && (!i.item || !filterType.includes(i.item.toLowerCase()))) return false;
      // status_atendimento removido do banco (migration 20260711) — filtro de status desativado
      return true;
    });
  }, [todosItens, filterRisk, filterType]);

  const stats = useMemo(() => {
    let alto = 0,
      medio = 0,
      baixo = 0;
    filteredItems.forEach((i) => {
      const r = (i.risco || "").toLowerCase();
      if (r === "critico" || r === "alto") alto++;
      else if (r === "medio") medio++;
      else if (r === "baixo") baixo++;
    });
    return { total: filteredItems.length, alto, medio, baixo };
  }, [filteredItems]);

  const defaultCenter: [number, number] =
    clienteAtivo?.latitude_centro && clienteAtivo?.longitude_centro
      ? [clienteAtivo.latitude_centro, clienteAtivo.longitude_centro]
      : [-15.78, -47.93];

  /** Cria tarefa de correção avulsa (pendente, sem operador). Pode ser atribuída depois em Operações. */
  const handleCreateTask = useCallback(async () => {
    if (!selectedItem || !clienteId) return;
    try {
      await api.operacoes.criarParaItem({
        clienteId,
        itemLevantamentoId: selectedItem.id,
        prioridade: selectedItem.prioridade || "Média",
        observacao: `Tarefa de correção — ${selectedItem.item || "Item"}`,
      });
      toast.success("Tarefa de correção criada. Atribua um operador em Operações.");
    } catch (err: unknown) {
      if (err instanceof Error && err.message === "ALREADY_EXISTS") {
        toast.info("Já existe uma tarefa aberta para este ponto.");
      } else {
        toast.error(err instanceof Error ? err.message : "Erro ao criar tarefa");
      }
    }
  }, [selectedItem, clienteId]);

  const handleSendFieldTeam = useCallback(
    async (responsavelId?: string) => {
      if (!selectedItem || !clienteId) return;
      try {
        await api.operacoes.enviarEquipeParaItem({
          clienteId,
          itemLevantamentoId: selectedItem.id,
          prioridade: selectedItem.prioridade || "Média",
          responsavelId,
          observacao: `Equipe enviada via mapa — ${selectedItem.item || "Item"}`,
        });
        toast.success("Equipe de campo enviada com sucesso");
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Erro ao enviar equipe");
      }
    },
    [selectedItem, clienteId],
  );

  const handleMarkResolved = useCallback(async () => {
    if (!selectedItem || !clienteId) return;
    try {
      await api.operacoes.resolverStatusItem(selectedItem.id);
      toast.success("Item marcado como resolvido");
      refetch();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao marcar como resolvido");
    }
  }, [selectedItem, clienteId, refetch]);

  const handleTracarRota = useCallback(() => {
    const ordered = nearestNeighbor(filteredItems);
    if (ordered.length < 2) {
      toast.warning("São necessários pelo menos 2 itens com coordenadas para traçar rota.");
      return;
    }
    const MAX_STOPS = 12;
    const stops = ordered.slice(0, MAX_STOPS);
    const origin = `${stops[0].latitude},${stops[0].longitude}`;
    const destination = `${stops[stops.length - 1].latitude},${stops[stops.length - 1].longitude}`;
    const waypoints = stops
      .slice(1, -1)
      .map((i) => `${i.latitude},${i.longitude}`)
      .join("|");
    const url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}${waypoints ? `&waypoints=${waypoints}` : ""}&travelmode=driving`;
    window.open(url, "_blank", "noopener,noreferrer");
    if (ordered.length > MAX_STOPS) {
      toast.info(`Rota traçada com ${MAX_STOPS} de ${ordered.length} pontos (limite do Google Maps).`);
    } else {
      toast.success(`Rota otimizada com ${stops.length} pontos aberta no Google Maps.`);
    }
  }, [filteredItems]);

  if (isLoading) {
    return (
      <div className="flex flex-1 min-h-0 bg-background items-center justify-center w-full p-4">
        <Card className="w-full max-w-sm overflow-hidden rounded-2xl border-border/60 shadow-lg">
          <CardContent className="flex flex-col items-center justify-center py-10 px-6">
            <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
            <p className="text-sm font-semibold text-foreground">Carregando seus itens...</p>
            <p className="text-xs text-muted-foreground mt-1">Aguarde um momento</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!clienteId || !usuario?.id) {
    return (
      <div className="flex flex-1 min-h-0 bg-background items-center justify-center w-full p-4">
        <Card className="w-full max-w-sm overflow-hidden rounded-2xl border-border/60 shadow-lg">
          <CardContent className="flex flex-col items-center justify-center py-10 px-6 text-center">
            <p className="font-semibold text-foreground">Cliente ou usuário não disponível.</p>
            <p className="text-sm text-muted-foreground mt-2">Entre em contato com o administrador.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-1 min-h-0 overflow-hidden bg-background relative -mx-4 sm:-mx-6 lg:-mr-8 lg:ml-0">
      {/* Painel de filtros — desktop: ocultável via toggle */}
      <div className={cn(!panelVisible && "lg:hidden")}>
        <MapFiltersPanel
          stats={stats}
          filterRisk={filterRisk}
          setFilterRisk={setFilterRisk}
          filterType={filterType}
          setFilterType={setFilterType}
          dateRange={dateRange}
          setDateRange={setDateRange}
          uniqueTypes={uniqueTypes}
          open={filtersOpen}
          onClose={() => setFiltersOpen(false)}
          onDesktopCollapse={() => setPanelVisible(false)}
        />
      </div>

      {/* Mobile: FAB para abrir filtros (rota 100% mobile) */}
      <Button
        variant="default"
        size="lg"
        className="fixed bottom-20 left-4 z-[450] lg:hidden h-12 pl-5 pr-4 rounded-xl shadow-lg gap-2 font-semibold"
        onClick={() => setFiltersOpen(true)}
      >
        <Filter className="w-5 h-5 shrink-0" />
        <span>Filtros</span>
        {(filterRisk.length > 0 || filterType.length > 0) && (
          <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-primary-foreground px-1 text-primary text-xs font-bold">
            {filterRisk.length + filterType.length}
          </span>
        )}
      </Button>

      {/* Mobile: FAB para traçar rota */}
      <Button
        variant="secondary"
        size="lg"
        className="fixed bottom-20 left-[calc(4rem+3.5rem+1rem)] z-[450] lg:hidden h-12 pl-5 pr-4 rounded-xl shadow-lg gap-2 font-semibold"
        onClick={handleTracarRota}
        disabled={filteredItems.filter((i) => i.latitude != null).length < 2}
      >
        <Route className="w-5 h-5 shrink-0" />
        <span>Traçar rota</span>
      </Button>


      <div className="flex-1 relative bg-muted/40 flex flex-col min-w-0 min-h-0 z-0">
        <MapToolbar />
        {/* Desktop: botão reabrir painel de filtros */}
        {!panelVisible && (
          <Button
            variant="secondary"
            size="sm"
            className="absolute top-2 left-2 z-[450] hidden lg:flex h-9 px-3 rounded-lg gap-1.5 font-semibold text-xs shadow-md"
            onClick={() => setPanelVisible(true)}
          >
            <PanelLeftOpen className="w-4 h-4 shrink-0" />
            Filtros
          </Button>
        )}
        {/* Desktop: botão Traçar rota — exibido apenas em telas lg+ */}
        <Button
          variant="secondary"
          size="sm"
          className="absolute top-[4.5rem] right-4 z-[400] hidden lg:flex h-9 px-3 rounded-lg gap-1.5 font-semibold text-xs shadow-md"
          onClick={handleTracarRota}
          disabled={filteredItems.filter((i) => i.latitude != null).length < 2}
        >
          <Route className="w-4 h-4 shrink-0" />
          Traçar rota
        </Button>
        <div className="absolute inset-0 z-0">
          <LeafletMapView
            items={filteredItems}
            center={defaultCenter}
            selectedItemId={selectedItem?.id}
            onSelectItem={(item) => setSelectedItem(item)}
          />
        </div>
      </div>

      {selectedItem && (
        isFocoRiscoItem(selectedItem) ? (
          <ItemDetailsPanel
            item={selectedItem}
            onClose={() => setSelectedItem(null)}
            onOpenImage={setPreviewImage}
            onMarkResolved={() => navigate(`/agente/focos/${selectedItem.id}`)}
          />
        ) : (
          <ItemDetailsPanel
            item={selectedItem}
            onClose={() => setSelectedItem(null)}
            onOpenImage={setPreviewImage}
            onCreateTask={handleCreateTask}
            onSendFieldTeam={handleSendFieldTeam}
            onMarkResolved={handleMarkResolved}
          />
        )
      )}

      <ImageModal isOpen={!!previewImage} onClose={() => setPreviewImage(null)} imageUrl={previewImage} />
    </div>
  );
}
