import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { LevantamentoItem, Planejamento, Regiao, PluvioRisco, StatusAtendimento } from '@/types/database';
import { loadCache, saveCache } from '@/lib/cache';
import { normalizeRiskBucket } from '@/lib/mapRiskFilter';
import { useMapData } from '@/hooks/queries/useMapData';
import PullToRefresh from '@/components/PullToRefresh';
import { useClienteAtivo } from '@/hooks/useClienteAtivo';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/services/api';
import { WifiOff, Loader2, MapPin, SlidersHorizontal } from 'lucide-react';
import { type LeafletMap, type MapMode, type PlanejamentoGeoJSON, type PlanejamentoPolygon, type RegiaoPolygon } from '@/components/map/InspectionLeafletMap';

import { MapFiltersPanel } from '@/components/map-dashboard/MapFiltersPanel';
import { MapToolbar } from '@/components/map-dashboard/MapToolbar';
import { MapView } from '@/components/map-dashboard/MapView';
import { RiskDetailsPanel } from '@/components/map-dashboard/RiskDetailsPanel';
import { ImagePreviewModal } from '@/components/map-dashboard/ImagePreviewModal';
import { toast } from 'sonner';

const MapaInspecao = () => {
  const [searchParams] = useSearchParams();
  const { clienteId, clienteAtivo } = useClienteAtivo();
  const { isAdmin } = useAuth();
  const [filtersOpen, setFiltersOpen] = useState(false);

  const { data: mapData, isLoading: loading, isError, refetch } = useMapData(clienteId);
  const offline = isError;

  const itens: LevantamentoItem[] = mapData?.itens ?? loadCache<LevantamentoItem>('map_itens');
  const clienteArea = mapData?.clienteArea ?? null;
  const planejamentos: Planejamento[] = mapData?.planejamentos ?? [];
  const regioes: Regiao[] = mapData?.regioes ?? [];
  const pluvioRiscoMap: Record<string, PluvioRisco> = mapData?.pluvioRiscoMap ?? {};

  // Filters State — ?risco=alto,critico (dashboard "ver no mapa")
  const [riskFilter, setRiskFilter] = useState<string[]>(() => {
    const r = searchParams.get('risco');
    if (!r) return [];
    return r.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  });

  useEffect(() => {
    const r = searchParams.get('risco');
    if (!r) return;
    const parts = r.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
    if (parts.length > 0) setRiskFilter(parts);
  }, [searchParams]);

  /** ?atendimento=pendente|em_atendimento|resolvido (ex.: dashboard KPI Pendentes) */
  const [atendimentoFilter, setAtendimentoFilter] = useState<'todos' | StatusAtendimento>(() => {
    const a = searchParams.get('atendimento')?.toLowerCase();
    if (a === 'pendente' || a === 'em_atendimento' || a === 'resolvido') return a;
    return 'todos';
  });
  useEffect(() => {
    const a = searchParams.get('atendimento')?.toLowerCase();
    if (a === 'pendente' || a === 'em_atendimento' || a === 'resolvido') setAtendimentoFilter(a);
    else setAtendimentoFilter('todos');
  }, [searchParams]);

  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<string>('30d');
  const [regionFilter, setRegionFilter] = useState<string>('all');

  // Map & Panel State
  const [mapMode, setMapMode] = useState<MapMode>('cluster');
  const [selectedItem, setSelectedItem] = useState<LevantamentoItem | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const mapInstanceRef = useRef<LeafletMap | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  // Persist items to cache on successful fetch
  useEffect(() => {
    if (mapData?.itens) saveCache('map_itens', mapData.itens);
  }, [mapData?.itens]);

  // Listener de clique nos marcadores do mapa (usa itens atual)
  useEffect(() => {
    const handleMapItemClick = (e: Event) => {
      const customEvent = e as CustomEvent;
      const item = itens.find((x) => x.id === customEvent.detail?.id);
      if (item) handleItemSelect(item);
    };
    window.addEventListener('map-item-click', handleMapItemClick);
    return () => window.removeEventListener('map-item-click', handleMapItemClick);
  }, [itens]);

  const handleMapReady = useCallback((map: LeafletMap) => { mapInstanceRef.current = map; }, []);

  const handleItemSelect = (item: LevantamentoItem) => {
    setSelectedItem(item);
    if (mapInstanceRef.current && item.latitude != null && item.longitude != null) {
      mapInstanceRef.current.flyTo([item.latitude, item.longitude], 18, { duration: 0.8 });
    }
  };

  const handleFullscreen = () => {
    if (!document.fullscreenElement && mapContainerRef.current) {
      mapContainerRef.current.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable fullscreen mode: ${err.message} (${err.name})`);
      });
    } else if (document.fullscreenElement) {
      document.exitFullscreen();
    }
  };

  // ─── FILTER LOGIC ─────────────────────────────────────────────────────────────
  const uniqueTypes = useMemo(() => {
    const s = new Set<string>();
    itens.forEach(i => i.item && s.add(i.item.toLowerCase()));
    return Array.from(s).sort();
  }, [itens]);

  const filteredItems = useMemo(() => {
    return itens.filter(i => {
      // Risk Filter — normalizar acentos ("Crítico" → critico) e variantes ("Muito alto" → critico)
      if (riskFilter.length > 0) {
        const bucket = normalizeRiskBucket(i.risco);
        if (!riskFilter.includes(bucket)) return false;
      }

      if (atendimentoFilter !== 'todos') {
        const st = (i.status_atendimento ?? 'pendente') as StatusAtendimento;
        if (st !== atendimentoFilter) return false;
      }

      // Type Filter
      if (typeFilter.length > 0) {
        if (!i.item || !typeFilter.includes(i.item.toLowerCase())) return false;
      }
      return true;
    });
  }, [itens, riskFilter, typeFilter, atendimentoFilter]);

  const validItems = filteredItems.filter(i => i.latitude != null && i.longitude != null);
  const defaultCenter: [number, number] =
    clienteAtivo?.latitude_centro && clienteAtivo?.longitude_centro
      ? [clienteAtivo.latitude_centro, clienteAtivo.longitude_centro]
      : [-15.78, -47.93];
  const center: [number, number] = validItems.length > 0 ? [validItems[0].latitude!, validItems[0].longitude!] : defaultCenter;

  // ─── SUMMARY STATS ────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    let crit = 0;
    let totalScore = 0;
    validItems.forEach(i => {
      if ((i.risco || '').toLowerCase() === 'critico') crit++;
      totalScore += (i.score_final || 0);
    });
    return {
      totalPoints: validItems.length,
      criticalPoints: crit,
      regionsAffected: new Set(validItems.map(i => i.endereco_curto)).size,
      averageScore: validItems.length ? Math.round(totalScore / validItems.length) : 0
    };
  }, [validItems]);

  // Prazo vencido = (data_hora ou created_at) + sla_horas já passou
  const slaStats = useMemo(() => {
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;
    let safe = 0;
    let warning = 0;
    let danger = 0;
    for (const i of validItems) {
      const horas = i.sla_horas ?? null;
      if (horas == null || horas < 1) {
        danger++;
        continue;
      }
      const inicio = i.data_hora || i.created_at;
      if (!inicio) {
        danger++;
        continue;
      }
      const prazoFinalMs = new Date(inicio).getTime() + horas * 60 * 60 * 1000;
      if (prazoFinalMs <= now) {
        danger++;
      } else if (prazoFinalMs <= now + oneDayMs) {
        warning++;
      } else {
        safe++;
      }
    }
    return { safe, warning, danger };
  }, [validItems]);

  if (loading) {
    return (
      <div className="flex bg-background items-center justify-center h-[calc(100vh-80px)] w-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!clienteId) {
    return (
      <div className="flex bg-background items-center justify-center min-h-[calc(100vh-80px)] w-full p-4">
        <div className="rounded-2xl border-2 border-cardBorder bg-card p-8 shadow-lg max-w-md w-full text-center">
          <MapPin className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-lg font-semibold text-foreground mb-2">Mapa de inspeção</h2>
          <p className="text-sm text-muted-foreground">
            {isAdmin
              ? 'Selecione um cliente no seletor acima para visualizar o mapa.'
              : 'Nenhum cliente vinculado à sua conta. Entre em contato com o administrador.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <PullToRefresh onRefresh={async () => { await refetch(); }} className="flex-1 min-h-0 flex flex-col">
      <div ref={mapContainerRef} className="flex flex-1 min-h-0 w-full overflow-hidden bg-background relative animate-fade-in min-h-[300px]">
        {/* LEFT PANEL */}
        <MapFiltersPanel
          stats={stats}
          filterRisk={riskFilter}
          setFilterRisk={setRiskFilter}
          filterType={typeFilter}
          setFilterType={setTypeFilter}
          dateRange={dateRange}
          setDateRange={setDateRange}
          region={regionFilter}
          setRegion={setRegionFilter}
          regions={regioes.map(r => ({ id: r.id, name: r.regiao }))}
          slaStats={slaStats}
          uniqueTypes={uniqueTypes}
          open={filtersOpen}
          onClose={() => setFiltersOpen(false)}
        />

        {/* MAIN MAP AREA */}
        <div className="flex-1 min-h-0 relative flex flex-col" style={{ minWidth: 0 }}>
          {offline && (
            <div className="absolute top-16 left-1/2 -translate-x-1/2 z-[400] flex items-center gap-3 px-4 py-2 rounded-full bg-red-500/90 text-white backdrop-blur-md shadow-lg border border-red-500">
              <WifiOff className="w-4 h-4 shrink-0" />
              <p className="text-xs font-bold">Modo Offline ativado</p>
            </div>
          )}

          {/* Mobile FAB — filter toggle */}
          <button
            onClick={() => setFiltersOpen(true)}
            className="absolute bottom-6 left-4 z-[400] flex lg:hidden items-center gap-2 h-11 px-4 rounded-2xl bg-card/95 backdrop-blur-md border border-border/60 shadow-lg text-sm font-bold text-foreground"
          >
            <SlidersHorizontal className="w-4 h-4 text-primary" />
            Filtros
            {(riskFilter.length > 0 || typeFilter.length > 0) && (
              <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-black flex items-center justify-center">
                {riskFilter.length + typeFilter.length}
              </span>
            )}
          </button>

          <MapToolbar
            heatmapMode={mapMode === 'heatmap'}
            onToggleHeatmap={(v) => setMapMode(v ? 'heatmap' : 'cluster')}
            clusterMode={mapMode === 'cluster'}
            onToggleCluster={(v) => setMapMode(v ? 'cluster' : 'heatmap')}
            onFullscreen={handleFullscreen}
            onExport={() => alert('Exportando PDF da tela operativa...')}
          />

          <MapView
            items={validItems}
            center={center}
            mode={mapMode}
            clienteArea={clienteArea as unknown as PlanejamentoGeoJSON}
            planejamentos={planejamentos as unknown as PlanejamentoPolygon[]}
            regioes={regioes as unknown as RegiaoPolygon[]}
            pluvioRiscoMap={pluvioRiscoMap}
            onMapReady={handleMapReady}
            onItemClick={handleItemSelect}
          />
        </div>

        {/* RIGHT PANEL - CONDITIONAL */}
        {selectedItem && (
          <RiskDetailsPanel
            item={selectedItem}
            onClose={() => setSelectedItem(null)}
            onOpenImage={setPreviewImage}
            onCreateTask={async (it) => {
              if (!clienteId) return;
              try {
                await api.operacoes.criarParaItem({
                  clienteId,
                  itemLevantamentoId: it.id,
                  prioridade: it.prioridade || 'Média',
                  observacao: `Tarefa de correção — ${it.item || 'ponto'}`,
                });
                toast.success('Tarefa de correção criada. Atribua um operador em Operações.');
              } catch (err: unknown) {
                if (err instanceof Error && err.message === 'ALREADY_EXISTS') {
                  toast.info('Já existe uma tarefa aberta para este ponto.');
                } else {
                  toast.error('Erro ao criar tarefa', { description: err instanceof Error ? err.message : String(err) });
                }
              }
            }}
            onSendFieldTeam={async (it, responsavelId) => {
              if (!clienteId) return;
              try {
                await api.operacoes.enviarEquipeParaItem({
                  clienteId,
                  itemLevantamentoId: it.id,
                  prioridade: it.prioridade || 'Média',
                  responsavelId,
                  observacao: `Equipe enviada via mapa — ${it.item || 'ponto'}`,
                });
                toast.success('Equipe enviada com sucesso', {
                  description: `Ponto: ${it.item || 'detecção'} (${it.endereco_curto || 'N/A'})`,
                });
              } catch (err: unknown) {
                toast.error('Erro ao enviar equipe', { description: err instanceof Error ? err.message : String(err) });
              }
            }}
            onMarkResolved={async (it) => {
              if (!clienteId) return;
              try {
                await api.operacoes.resolverItem({
                  clienteId,
                  itemLevantamentoId: it.id,
                  prioridade: it.prioridade || 'Média',
                  observacao: `Resolvido via mapa — ${it.item || 'ponto'}`,
                });
                toast.success('Marcado como resolvido', {
                  description: `${it.item || 'Ponto'} — atualizado com sucesso.`,
                });
              } catch (err: unknown) {
                toast.error('Erro', { description: err instanceof Error ? err.message : String(err) });
              }
            }}
          />
        )}
      </div>

      <ImagePreviewModal
        isOpen={!!previewImage}
        onClose={() => setPreviewImage(null)}
        imageUrl={previewImage}
      />
    </PullToRefresh>
  );
};

export default MapaInspecao;
