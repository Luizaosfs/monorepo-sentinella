import { useEffect, useState } from "react";
import "@/lib/leaflet";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import { LevantamentoItem, FocoRiscoAtivo } from "@/types/database";
import { MapClusterLayer } from "./MapClusterLayer";
import { MapPopupLayer } from "./MapPopupLayer";
import { HeatmapLayer } from "./HeatmapLayer";
import { FocoClusterLayer } from "./FocoClusterLayer";
import { useTheme } from "@/hooks/useTheme";
import { TILE_LAYERS, type TileLayerType } from "@/components/map/tileLayerControl";
import { cn } from "@/lib/utils";
import "leaflet/dist/leaflet.css";

interface LeafletMapViewProps {
  items: LevantamentoItem[];
  center: [number, number];
  selectedItemId?: string | null;
  popupOpenItemId?: string | null;
  onMarkerClick?: (item: LevantamentoItem) => void;
  onClosePopup?: () => void;
  onVerDetalhes?: () => void;
  onSelectItem?: (item: LevantamentoItem) => void;
  heatmapEnabled?: boolean;
  itemStatuses?: Record<string, string>;
  focos?: FocoRiscoAtivo[];
  onFocoClick?: (foco: FocoRiscoAtivo) => void;
  onFocoVistoria?: (foco: FocoRiscoAtivo) => void;
}

function MapFitter({ items, focos = [], fallbackCenter }: { items: LevantamentoItem[]; focos?: FocoRiscoAtivo[]; fallbackCenter: [number, number] }) {
  const map = useMap();

  useEffect(() => {
    const bounds: [number, number][] = [
      ...items.filter((i) => i.latitude != null && i.longitude != null).map((i) => [i.latitude!, i.longitude!] as [number, number]),
      ...focos.filter((f) => f.latitude != null && f.longitude != null).map((f) => [f.latitude!, f.longitude!] as [number, number]),
    ];
    if (bounds.length > 1) {
      map.fitBounds(bounds, { padding: [40, 40] });
    } else if (bounds.length === 1) {
      map.setView(bounds[0], 16);
    } else {
      map.setView(fallbackCenter, 13);
    }
  }, [items, focos, map, fallbackCenter]);

  return null;
}

const TILE_KEYS: TileLayerType[] = ["street", "satellite", "hybrid", "terrain", "dark"];

export function LeafletMapView({
  items,
  center,
  selectedItemId = null,
  popupOpenItemId = null,
  onMarkerClick,
  onClosePopup = () => {},
  onVerDetalhes = () => {},
  onSelectItem,
  heatmapEnabled = false,
  itemStatuses = {},
  focos,
  onFocoClick,
  onFocoVistoria,
}: LeafletMapViewProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [tileType, setTileType] = useState<TileLayerType>(() => (isDark ? "dark" : "street"));

  const tileConfig = TILE_LAYERS[tileType];
  const mapBg = isDark ? "#0f172a" : "#f1f5f9";

  const popupItem = popupOpenItemId != null ? (items.find((i) => i.id === popupOpenItemId) ?? null) : null;

  return (
    <div className="w-full h-full relative z-0" data-map-container>
      {/* Seletor de base do mapa — no mobile fica abaixo da toolbar, alinhado à direita para não sobrepor a legenda */}
      <div className="absolute top-2 left-6 z-[1000] flex-wrap gap-1 rounded-lg border border-border/60 bg-card/95 p-1.5 shadow-lg backdrop-blur-sm sm:top-3 max-w-[calc(100%-6rem)] justify-end flex flex-col">
        {TILE_KEYS.map((key) => {
          const cfg = TILE_LAYERS[key];
          const active = tileType === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setTileType(key)}
              className={cn(
                "rounded-md px-2 py-1.5 text-[11px] font-medium transition-colors whitespace-nowrap",
                active ? "bg-primary text-primary-foreground" : "bg-transparent text-foreground hover:bg-muted/60",
              )}
            >
              {cfg.label}
            </button>
          );
        })}
      </div>

      <MapContainer center={center} zoom={12} style={{ width: "100%", height: "100%" }} zoomControl={false}>
        <TileLayer
          key={tileType}
          url={tileConfig.url}
          attribution={tileConfig.attribution}
          maxZoom={tileConfig.maxZoom}
        />

        {!heatmapEnabled && (
          <MapClusterLayer
            items={items}
            selectedItemId={selectedItemId}
            onMarkerClick={(item) => {
              if (onSelectItem) onSelectItem(item);
              if (onMarkerClick) onMarkerClick(item);
            }}
            itemStatuses={itemStatuses}
          />
        )}
        {heatmapEnabled && <HeatmapLayer items={items} />}
        {popupItem && <MapPopupLayer item={popupItem} onClose={onClosePopup} onVerDetalhes={onVerDetalhes} />}
        {focos && focos.length > 0 && (
          <FocoClusterLayer focos={focos} onFocoClick={onFocoClick} onFocoVistoria={onFocoVistoria} />
        )}
        <MapFitter items={items} focos={focos} fallbackCenter={center} />
      </MapContainer>

      {/* Status legend — no mobile fica no canto inferior esquerdo (acima do nav) para não sobrepor toolbar/seletor de mapa */}
      <div className="absolute bottom-20 left-6 z-[1000] bg-card/90 backdrop-blur-sm border border-border/60 rounded-xl px-3 py-2.5 shadow-lg text-xs space-y-1.5 sm:bottom-auto sm:top-4 lg:bottom-auto">
        <p className="font-bold text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Legenda</p>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-red-500 border-2 border-white/80 shadow-sm" />
          <span className="text-foreground font-medium flex flex-col leading-tight">
            <span>Alto / Crítico</span>
            <span className="text-[10px] text-muted-foreground font-semibold">Priorizar vistoria</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-orange-500 border-2 border-white/80 shadow-sm" />
          <span className="text-foreground font-medium flex flex-col leading-tight">
            <span>Médio</span>
            <span className="text-[10px] text-muted-foreground font-semibold">Planejar e atacar</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-emerald-500 border-2 border-white/80 shadow-sm" />
          <span className="text-foreground font-medium flex flex-col leading-tight">
            <span>Baixo</span>
            <span className="text-[10px] text-muted-foreground font-semibold">Monitorar</span>
          </span>
        </div>
        <div className="border-t border-border/40 pt-1.5 mt-1.5 space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="relative inline-flex items-center justify-center w-4 h-4 rounded-full bg-muted border-2 border-white/80">
              <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-blue-500 border border-white flex items-center justify-center">
                <svg
                  width="6"
                  height="6"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#fff"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </span>
            </span>
            <span className="text-foreground font-medium">Equipe enviada</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="relative inline-flex items-center justify-center w-4 h-4 rounded-full bg-muted border-2 border-white/80">
              <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-500 border border-white flex items-center justify-center">
                <svg
                  width="6"
                  height="6"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#fff"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </span>
            </span>
            <span className="text-foreground font-medium">Resolvido</span>
          </div>
        </div>
      </div>

      <style>{`
        .leaflet-container { font-family: inherit; background: ${mapBg}; }
        .sentinella-cluster-icon:hover .sentinella-cluster-inner {
          transform: scale(1.08);
          box-shadow: 0 0 0 3px rgba(255,255,255,0.25), 0 6px 20px rgba(5,150,105,0.5);
        }
        .sentinella-leaflet-popup .leaflet-popup-content-wrapper { padding: 0; border-radius: 12px; overflow: hidden; border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 10px 25px rgba(0,0,0,0.3); }
        .sentinella-leaflet-popup .leaflet-popup-content { margin: 0; }
        .sentinella-leaflet-popup .leaflet-popup-tip { background: rgb(2 6 23 / 0.9); }
      `}</style>
    </div>
  );
}
