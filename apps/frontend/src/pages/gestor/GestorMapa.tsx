import { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { MapContainer, TileLayer } from 'react-leaflet';
import { Loader2, Layers, Crosshair, ScanSearch, Filter, MapPinned, Stethoscope } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useClienteAtivo } from '@/hooks/useClienteAtivo';
import { useIsMobile } from '@/hooks/use-mobile';
import { useMapaFocosRealtime } from '@/hooks/mapa/useMapaFocosRealtime';
import { useRegioes } from '@/hooks/queries/useRegioes';
import { FocoClusterLayer } from '@/components/map-v3/FocoClusterLayer';
import { CasosMapaLayer } from '@/components/map-v3/CasosMapaLayer';
import { FocoRiscoCard } from '@/components/foco/FocoRiscoCard';
import { GestorMapaFiltersPanel } from '@/components/gestor/GestorMapaFiltersPanel';
import { useAtualizarStatusFoco } from '@/hooks/queries/useFocosRisco';
import { api } from '@/services/api';
import { STALE } from '@/lib/queryConfig';
import { useCasosNotificados } from '@/hooks/queries/useCasosNotificados';
import {
  DEFAULT_GESTOR_MAPA_FILTERS,
  filterFocosForGestorMapa,
  computeGestorMapaFocoStats,
  countGestorMapaFilterSelections,
  type GestorMapaFocoFilterState,
  type ScoreClassificacaoFiltro,
} from '@/lib/gestorMapaFocoFilters';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import '@/lib/leaflet';
import 'leaflet/dist/leaflet.css';
import type { FocoRiscoAtivo, FocoRiscoStatus } from '@/types/database';

// ItemDetailPanel importado dinamicamente para não bloquear o mapa
import ItemDetailPanel from '@/components/levantamentos/ItemDetailPanel';

export default function GestorMapa() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { clienteId, clienteAtivo, loading: clienteLoading } = useClienteAtivo();
  const isMobile = useIsMobile();
  const { focos, isLoading } = useMapaFocosRealtime(clienteId);
  const { data: regioes = [] } = useRegioes(clienteId);
  const atualizar = useAtualizarStatusFoco();

  const [selectedFoco, setSelectedFoco] = useState<FocoRiscoAtivo | null>(null);
  const [activeTab, setActiveTab] = useState<'foco' | 'evidencia'>('foco');
  const [filtersPanelVisible, setFiltersPanelVisible] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [mapFilters, setMapFilters] = useState<GestorMapaFocoFilterState>(() => {
    const classificacao = searchParams.get('classificacao') as ScoreClassificacaoFiltro | null;
    if (classificacao) return { ...DEFAULT_GESTOR_MAPA_FILTERS, scoreClassificacao: [classificacao] };
    return DEFAULT_GESTOR_MAPA_FILTERS;
  });
  const [mostrarCasos, setMostrarCasos] = useState(false);

  const { data: casos = [] } = useCasosNotificados(mostrarCasos ? clienteId : null);

  useEffect(() => {
    if (!mostrarCasos || casos.length === 0) return;
    const comPos = casos.filter((c) => c.latitude != null && c.longitude != null && c.status !== 'descartado').length;
    if (comPos === 0) {
      toast.warning(`${casos.length} caso(s) encontrado(s), mas nenhum possui coordenadas para exibir no mapa. Geocodifique os casos em Admin → Casos Notificados.`);
    } else {
      toast.info(`${comPos} caso(s) exibido(s) no mapa de ${casos.length} total.`);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mostrarCasos, casos.length]);

  const casoIds = useMemo(() => casos.map((c) => c.id), [casos]);
  const { data: casoIdsComCruzamento = [] } = useQuery({
    queryKey: ['casos-cruzamentos-mapa', casoIds],
    queryFn: () => api.casosNotificados.listCasoIdsComCruzamento(casoIds),
    enabled: mostrarCasos && casoIds.length > 0,
    staleTime: STALE.SHORT,
  });
  const comCruzamentoSet = useMemo(() => new Set(casoIdsComCruzamento), [casoIdsComCruzamento]);

  const focosFiltrados = useMemo(
    () => filterFocosForGestorMapa(focos, mapFilters),
    [focos, mapFilters],
  );

  const statsMapa = useMemo(() => computeGestorMapaFocoStats(focosFiltrados), [focosFiltrados]);

  const filtrosAtivosCount = useMemo(() => countGestorMapaFilterSelections(mapFilters), [mapFilters]);

  const itemId = selectedFoco?.origem_levantamento_item_id ?? null;
  const temEvidencia = !!itemId;

  const mapCenter = useMemo((): [number, number] => {
    const lat = clienteAtivo?.latitude_centro;
    const lng = clienteAtivo?.longitude_centro;
    if (lat != null && lng != null) return [lat, lng];
    return [-15.7942, -47.8822];
  }, [clienteAtivo?.latitude_centro, clienteAtivo?.longitude_centro]);

  const tabsValue = activeTab;

  const { data: itemEvidencia, isLoading: itemLoading } = useQuery({
    queryKey: ['item-evidencia-mapa', itemId],
    queryFn: () => api.itens.getById(itemId!),
    enabled: !!itemId,
    staleTime: STALE.LONG,
  });

  const handleClose = useCallback(() => {
    setSelectedFoco(null);
    setActiveTab('foco');
  }, []);

  const handleFocoClick = useCallback((foco: FocoRiscoAtivo) => {
    setSelectedFoco(foco);
    setActiveTab('foco');
  }, []);

  const handleTransicionar = useCallback(
    (foco: FocoRiscoAtivo, statusNovo: string) => {
      atualizar.mutate(
        { focoId: foco.id, statusNovo: statusNovo as FocoRiscoStatus },
        {
          onSuccess: () => {
            toast.success('Status atualizado.');
            handleClose();
          },
          onError: () => toast.error('Falha ao atualizar status.'),
        },
      );
    },
    [atualizar, handleClose],
  );

  const handleSheetOpenChange = useCallback(
    (open: boolean) => {
      if (!open) handleClose();
    },
    [handleClose],
  );

  return (
    <div
      className="flex w-full flex-1 min-h-0 overflow-hidden bg-background relative -mx-4 sm:-mx-6 lg:-mx-8"
      style={{ height: 'calc(100vh - 64px)' }}
    >
      {filtersPanelVisible && (
        <GestorMapaFiltersPanel
          stats={statsMapa}
          totalFocosCarregados={focos.length}
          filters={mapFilters}
          onChange={setMapFilters}
          regioes={regioes}
          mobileOpen={mobileFiltersOpen}
          onMobileClose={() => setMobileFiltersOpen(false)}
          onCollapse={() => {
            setFiltersPanelVisible(false);
            setMobileFiltersOpen(false);
          }}
        />
      )}

      <div className="relative flex-1 min-w-0 min-h-0 isolate">
        {(isLoading || clienteLoading) && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/70 backdrop-blur-sm">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        )}

        {!clienteLoading && (
          <MapContainer
            key={clienteId ?? 'default'}
            center={mapCenter}
            zoom={13}
            style={{ width: '100%', height: '100%' }}
            zoomControl={!isMobile}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            />
            <FocoClusterLayer focos={focosFiltrados} onFocoClick={handleFocoClick} onFocoVistoria={(foco) => navigate(`/gestor/focos/${foco.id}`)} />
            {mostrarCasos && <CasosMapaLayer casos={casos} comCruzamento={comCruzamentoSet} />}
          </MapContainer>
        )}

        {/* Véu no stack do mapa (não fixed): acima do Leaflet e dos botões; painel de filtros (fixed) fica por cima */}
        {filtersPanelVisible && mobileFiltersOpen && (
          <div
            className="absolute inset-0 z-[520] bg-black/50 backdrop-blur-[2px] lg:hidden"
            onClick={() => setMobileFiltersOpen(false)}
            aria-hidden
          />
        )}

        {/* Botão voltar sobreposto */}
        <div className="absolute top-3 left-3 z-[500] flex flex-col gap-2 items-start">
          <Button
            size="sm"
            variant="secondary"
            className="shadow-md"
            onClick={() => navigate('/gestor/focos')}
          >
            <Layers className="w-4 h-4 mr-1" />
            Lista de focos
          </Button>
          <Button
            size="sm"
            variant={mostrarCasos ? 'default' : 'secondary'}
            className="shadow-md gap-1.5"
            onClick={() => setMostrarCasos((v) => !v)}
            title="Alternar camada de casos notificados"
          >
            <Stethoscope className="w-4 h-4" />
            {mostrarCasos ? 'Ocultar casos' : 'Ver casos'}
            {mostrarCasos && casos.length > 0 && (
              <span className="ml-0.5 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-primary-foreground px-1 text-primary text-[10px] font-bold">
                {casos.length}
              </span>
            )}
          </Button>
          {!filtersPanelVisible && (
            <Button
              size="sm"
              variant="default"
              className="shadow-md gap-1.5"
              onClick={() => {
                setFiltersPanelVisible(true);
                if (isMobile) setMobileFiltersOpen(true);
              }}
            >
              <Filter className="w-4 h-4" />
              Mostrar filtros
              {filtrosAtivosCount > 0 && (
                <span className="ml-0.5 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-primary-foreground px-1 text-primary text-[10px] font-bold">
                  {filtrosAtivosCount}
                </span>
              )}
            </Button>
          )}
        </div>

        {/* Contador */}
        <div className="absolute top-3 right-3 z-[500] max-w-[min(100vw-6rem,14rem)]">
          <div
            className={cn(
              'flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs font-semibold shadow-lg backdrop-blur-sm',
              focosFiltrados.length !== focos.length
                ? 'border-primary/35 bg-primary/[0.07] text-foreground'
                : 'border-border/60 bg-card/95 text-foreground',
            )}
          >
            <MapPinned className="h-3.5 w-3.5 shrink-0 text-primary opacity-90" aria-hidden />
            <span className="tabular-nums leading-tight">
              <strong>{focosFiltrados.length}</strong>
              {focosFiltrados.length !== focos.length && (
                <span className="font-normal text-muted-foreground"> / {focos.length}</span>
              )}{' '}
              <span className="font-medium text-muted-foreground">no mapa</span>
            </span>
          </div>
        </div>

        {filtersPanelVisible && isMobile && !mobileFiltersOpen && (
          <Button
            variant="default"
            size="lg"
            className="fixed bottom-20 left-4 z-[450] h-12 pl-5 pr-4 rounded-xl shadow-lg gap-2 font-semibold lg:hidden"
            onClick={() => setMobileFiltersOpen(true)}
          >
            <Filter className="w-5 h-5 shrink-0" />
            <span>Filtros</span>
            {filtrosAtivosCount > 0 && (
              <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-primary-foreground px-1 text-primary text-xs font-bold">
                {filtrosAtivosCount}
              </span>
            )}
          </Button>
        )}
      </div>

      {/* Sheet com abas */}
      <Sheet open={!!selectedFoco} onOpenChange={handleSheetOpenChange}>
        <SheetContent
          side={isMobile ? 'bottom' : 'right'}
          className={
            isMobile
              ? 'h-[72vh] overflow-y-auto'
              : 'w-full max-w-sm p-0 overflow-y-auto'
          }
        >
          <SheetHeader className={isMobile ? 'mb-2' : 'px-6 pt-6 pb-2'}>
            <SheetTitle className="sr-only">Detalhe do foco</SheetTitle>
          </SheetHeader>

          {selectedFoco && (
            <Tabs
              value={tabsValue}
              onValueChange={(v) => {
                if (v === 'foco' || v === 'evidencia') setActiveTab(v);
              }}
              className="flex flex-col h-full"
            >
              <TabsList className="mx-4 mb-3 grid w-[calc(100%-2rem)] grid-cols-2">
                <TabsTrigger value="foco" className="gap-1.5 text-xs">
                  <Crosshair className="w-3.5 h-3.5" />
                  Foco selecionado
                </TabsTrigger>
                <TabsTrigger value="evidencia" className="gap-1.5 text-xs">
                  <ScanSearch className="w-3.5 h-3.5" />
                  Evidência drone
                </TabsTrigger>
              </TabsList>

              {/* Aba 1 — Foco */}
              <TabsContent value="foco" className="flex-1 overflow-y-auto px-4 pb-4 mt-0">
                <FocoRiscoCard
                  foco={selectedFoco}
                  onAbrirDetalhe={() => navigate(`/gestor/focos/${selectedFoco.id}`)}
                  onTransicionar={handleTransicionar}
                />
              </TabsContent>

              {/* Aba 2 — Evidência drone */}
              <TabsContent value="evidencia" className="flex-1 overflow-y-auto mt-0 px-4 pb-4">
                {!temEvidencia ? (
                  <p className="text-xs text-muted-foreground text-center py-8 px-4">
                    Foco de origem manual — sem imagem de drone vinculada.
                  </p>
                ) : itemLoading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : itemEvidencia ? (
                  <ItemDetailPanel
                    item={itemEvidencia}
                    onBack={() => setActiveTab('foco')}
                    variant="sheet"
                  />
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-8 px-4">
                    Imagem de evidência não encontrada para este foco.
                  </p>
                )}
              </TabsContent>
            </Tabs>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
