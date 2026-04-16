import { useEffect, useRef, useState } from 'react';
import L from '@/lib/leaflet';
import type { LatLngExpression, LatLngTuple, Map as LeafletMap } from 'leaflet';
import 'leaflet.markercluster';
import 'leaflet.heat';
import { useTheme } from '@/hooks/useTheme';
import { normalizeRiskBucket } from '@/lib/mapRiskFilter';
import { LevantamentoItem, PluvioRisco } from '@/types/database';
import { resolveMediaUrl } from '@/lib/media';
import { addTileLayerControl, type TileLayerType } from '@/components/map/tileLayerControl';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

export type MapMode = 'cluster' | 'heatmap';

type HeatmapConfig = {
  radius: number;
  blur: number;
};

export type PlanejamentoGeoJSON = {
  type: 'Polygon';
  coordinates: number[][][];
};

export type PlanejamentoPolygon = {
  id: string;
  descricao: string | null;
  area: PlanejamentoGeoJSON | null;
};

export type RegiaoPolygon = {
  id: string;
  regiao: string;
  area: PlanejamentoGeoJSON | null;
};

type InspectionLeafletMapProps = {
  items: LevantamentoItem[];
  center: [number, number];
  mode?: MapMode;
  clienteArea?: PlanejamentoGeoJSON | null;
  heatmapConfig?: HeatmapConfig;
  planejamentos?: PlanejamentoPolygon[];
  showPlanejamentos?: boolean;
  regioes?: RegiaoPolygon[];
  showRegioes?: boolean;
  pluvioRiscoMap?: Record<string, PluvioRisco>;
  onMapReady?: (map: LeafletMap) => void;
  onItemClick?: (item: LevantamentoItem) => void;
};

export { type LeafletMap };

const PLAN_COLORS = [
  'hsl(210, 80%, 55%)',
  'hsl(280, 65%, 55%)',
  'hsl(330, 70%, 50%)',
  'hsl(170, 70%, 40%)',
  'hsl(45, 85%, 50%)',
  'hsl(15, 75%, 50%)',
  'hsl(240, 60%, 60%)',
  'hsl(120, 50%, 45%)',
];

const RISK_WEIGHT: Record<string, number> = {
  critico: 1.0,
  alto: 0.75,
  medio: 0.5,
  baixo: 0.25,
};

const riskColor = (risco: string | null): string => {
  switch ((risco || '').toLowerCase()) {
    case 'critico': return 'hsl(0, 72%, 45%)';
    case 'alto': return 'hsl(0, 72%, 58%)';
    case 'medio': return 'hsl(38, 92%, 50%)';
    case 'baixo': return 'hsl(152, 69%, 40%)';
    default: return 'hsl(210, 10%, 55%)';
  }
};

const createMarkerIcon = (item: LevantamentoItem) => {
  const color = riskColor(item.risco);
  const type = (item.item || '').toLowerCase();

  let svgPath = '<circle cx="12" cy="12" r="10" fill="currentColor" />'; // generic dot

  if (type.includes('pneu')) {
    svgPath = '<path fill="currentColor" d="M12 2a10 10 0 100 20 10 10 0 000-20zm0 15a5 5 0 110-10 5 5 0 010 10z"/>'; // tire-like
  } else if (type.includes('lixo') || type.includes('entulho')) {
    svgPath = '<path fill="currentColor" d="M9 3v1H4v2h1v13a2 2 0 002 2h10a2 2 0 002-2V6h1V4h-5V3H9zm3 3h4v11h-4V6z"/>'; // trash-like
  } else if (type.includes('poca') || type.includes('poça') || type.includes('agua') || type.includes('água') || type.includes('piscina') || type.includes('caixa')) {
    svgPath = '<path fill="currentColor" d="M12 2A2.5 2.5 0 009.5 4.5c0 1.5 2.5 5.5 2.5 5.5s2.5-4 2.5-5.5A2.5 2.5 0 0012 2zM12 22a8 8 0 100-16 8 8 0 000 16z" opacity="0.8"/><path fill="currentColor" d="M12 12a1 1 0 00-.7.3l-2 2a1 1 0 101.4 1.4l1.3-1.3V18a1 1 0 102 0v-3.6l1.3 1.3a1 1 0 001.4-1.4l-2-2a1 1 0 00-.7-.3z"/>'; // droplet combined
    svgPath = '<path fill="currentColor" d="M7 21C7 21 0 13 0 9C0 4.6 4.5 0 12 0C19.5 0 24 4.6 24 9C24 13 17 21 17 21L12 26L7 21Z" /><circle cx="12" cy="9" r="4" fill="white" />'; // generic pin
    svgPath = '<path fill="currentColor" d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>'; // droplet
  }

  const html = `
    <div style="width:24px;height:24px;background-color:${color};border-radius:50%;border:2px solid white;box-shadow:0 2px 5px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;color:white;">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        ${svgPath}
      </svg>
    </div>
  `;

  return L.divIcon({
    className: '',
    html,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12],
  });
};

// Removed legacy tileUrlByTheme — now using tileLayerControl

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const popupHtml = (item: LevantamentoItem) => {
  const title = escapeHtml(item.item || 'Item');
  const address = item.endereco_curto ? `<p style="margin:4px 0 0;color:hsl(var(--muted-foreground));font-size:12px;">${escapeHtml(item.endereco_curto)}</p>` : '';
  const risk = item.risco
    ? `<span style="display:inline-block;padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:700;background:${riskColor(item.risco)}22;color:${riskColor(item.risco)};text-transform:capitalize;">${escapeHtml(item.risco)}</span>`
    : '';
  const score = item.score_final != null
    ? `<span style="display:inline-block;padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:700;background:hsl(var(--muted));color:hsl(var(--foreground));">Score ${item.score_final}</span>`
    : '';

  const imgUrl = resolveMediaUrl(item.image_url);
  const imgBlock = imgUrl
    ? `<div style="margin-bottom:8px;border-radius:8px;overflow:hidden;border:1px solid hsl(var(--border)); cursor: pointer;" onclick="window.dispatchEvent(new CustomEvent('map-item-click', { detail: { id: '${item.id}' } }))">
        <img src="${imgUrl.replace(/"/g, '&quot;')}" alt="" style="width:100%;max-height:140px;object-fit:cover;display:block;" loading="lazy" />
       </div>`
    : '';

  return `
    <div style="min-width:200px;max-width:240px;display:grid;gap:8px;color:hsl(var(--foreground));font-family:inherit;">
      ${imgBlock}
      <div>
        <p style="margin:0;font-size:13px;font-weight:800;line-height:1.2;">${title}</p>
        ${address}
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;">${risk}${score}</div>
      <button
        onclick="window.dispatchEvent(new CustomEvent('map-item-click', { detail: { id: '${item.id}' } }))"
        style="width:100%;padding:6px;background:hsl(var(--primary));color:hsl(var(--primary-foreground));border:none;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;margin-top:4px;"
      >
        Ver Detalhes
      </button>
    </div>
  `;
};

const REGIAO_COLORS = [
  'hsl(30, 80%, 50%)',
  'hsl(60, 70%, 45%)',
  'hsl(150, 60%, 45%)',
  'hsl(200, 70%, 50%)',
  'hsl(260, 60%, 55%)',
  'hsl(310, 65%, 50%)',
  'hsl(0, 65%, 55%)',
  'hsl(90, 55%, 45%)',
];

const CLASSIFICACAO_COLORS: Record<string, string> = {
  'Baixo': 'hsl(152, 69%, 40%)',
  'Moderado': 'hsl(38, 92%, 50%)',
  'Alto': 'hsl(25, 85%, 50%)',
  'Muito Alto': 'hsl(0, 72%, 55%)',
  'Critico': 'hsl(0, 72%, 40%)',
  'Crítico': 'hsl(0, 72%, 40%)',
};

const InspectionLeafletMap = ({ items, center, mode = 'cluster', clienteArea, heatmapConfig, planejamentos, showPlanejamentos = true, regioes, showRegioes = true, pluvioRiscoMap = {}, onMapReady, onItemClick }: InspectionLeafletMapProps) => {
  const { theme } = useTheme();
  const mapNodeRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const [containerReady, setContainerReady] = useState(false);
  const markersLayerRef = useRef<L.MarkerClusterGroup | null>(null);
  const heatLayerRef = useRef<L.Layer | null>(null);
  const tileControlRef = useRef<{ setTileType: (t: TileLayerType) => void } | null>(null);
  const clienteAreaLayerRef = useRef<L.Polygon | null>(null);
  const planejamentoLayerRef = useRef<L.FeatureGroup>(new L.FeatureGroup());
  const planLegendRef = useRef<L.Control | null>(null);
  const regioesLayerRef = useRef<L.FeatureGroup>(new L.FeatureGroup());
  const regioesLegendRef = useRef<L.Control | null>(null);

  // Handle custom event for popup button clicks
  useEffect(() => {
    const handleCustomClick = (e: Event) => {
      const customEvent = e as CustomEvent;
      const itemId = customEvent.detail?.id;
      const item = items.find(i => i.id === itemId);
      if (item && onItemClick) onItemClick(item);
    };
    window.addEventListener('map-item-click', handleCustomClick);
    return () => window.removeEventListener('map-item-click', handleCustomClick);
  }, [items, onItemClick]);

  // Esperar o container ter dimensões antes de criar o mapa (evita mapa em branco)
  useEffect(() => {
    const el = mapNodeRef.current;
    if (!el) return;
    const check = () => {
      if (el.offsetWidth > 0 && el.offsetHeight > 0) {
        setContainerReady(true);
        return true;
      }
      return false;
    };
    if (check()) return;
    const ro = new ResizeObserver(() => {
      if (check()) ro.disconnect();
    });
    ro.observe(el);
    const t = setTimeout(() => {
      check();
      ro.disconnect();
    }, 500);
    return () => { ro.disconnect(); clearTimeout(t); };
  }, []);

  // Init map (só quando o container tiver tamanho)
  useEffect(() => {
    if (!containerReady || !mapNodeRef.current || mapRef.current) return;

    const node = mapNodeRef.current;
    // Evita "Map container is already initialized" (ex.: hot reload, Strict Mode)
    const LMap = L as unknown as {
      Map?: { get?: (el: HTMLElement) => L.Map | undefined; _map?: Record<number, L.Map> };
    };
    let existingMap = LMap.Map?.get?.(node);
    if (!existingMap && (node as unknown as { _leaflet_id?: number })._leaflet_id != null) {
      const id = (node as unknown as { _leaflet_id: number })._leaflet_id;
      existingMap = LMap.Map?._map?.[id];
    }
    if (existingMap?.remove) {
      try {
        existingMap.remove();
      } catch (_) { /* ignore */ }
    }

    const map = L.map(node, { zoomControl: true }).setView(center as LatLngExpression, 13);
    mapRef.current = map;
    onMapReady?.(map);

    const initialTile: TileLayerType = theme === 'dark' ? 'dark' : 'street';
    const tc = addTileLayerControl(map, initialTile, 'topright');
    tileControlRef.current = tc;

    // Add planejamento layer group
    planejamentoLayerRef.current.addTo(map);

    // Add regioes layer group
    regioesLayerRef.current.addTo(map);

    const legend = new L.Control({ position: 'bottomright' });
    legend.onAdd = () => {
      const div = L.DomUtil.create('div');
      div.innerHTML = `
        <div style="background:hsl(var(--card));border:1px solid hsl(var(--border));border-radius:10px;padding:10px 14px;font-family:inherit;font-size:11px;box-shadow:0 2px 12px rgba(0,0,0,0.12);min-width:110px;">
          <p style="margin:0 0 6px;font-weight:700;font-size:11px;color:hsl(var(--foreground));text-transform:uppercase;letter-spacing:0.05em;">Risco</p>
          ${[
            { label: 'Crítico', color: 'hsl(0, 72%, 45%)' },
            { label: 'Alto', color: 'hsl(0, 72%, 58%)' },
            { label: 'Médio', color: 'hsl(38, 92%, 50%)' },
            { label: 'Baixo', color: 'hsl(152, 69%, 40%)' },
            { label: 'Indefinido', color: 'hsl(210, 10%, 55%)' },
          ].map(r => `
            <div style="display:flex;align-items:center;gap:8px;margin-top:4px;">
              <span style="width:10px;height:10px;border-radius:50%;background:${r.color};flex-shrink:0;"></span>
              <span style="color:hsl(var(--foreground));">${r.label}</span>
            </div>
          `).join('')}
        </div>
      `;
      return div;
    };
    legend.addTo(map);

    // Recalcular tamanho após layout estável (flex/condicional)
    const t1 = setTimeout(() => map.invalidateSize(), 100);
    const t2 = setTimeout(() => map.invalidateSize(), 400);
    const t3 = setTimeout(() => map.invalidateSize(), 800);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      tileControlRef.current = null;
      markersLayerRef.current = null;
      heatLayerRef.current = null;
      clienteAreaLayerRef.current = null;
      try {
        if (map.closePopup) map.closePopup();
      } catch (_) { /* ignore */ }
      try {
        map.remove();
      } catch (_) { /* ignore */ }
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerReady]);

  // Cliente area polygon
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    if (clienteAreaLayerRef.current) {
      map.removeLayer(clienteAreaLayerRef.current);
      clienteAreaLayerRef.current = null;
    }

    if (!clienteArea || clienteArea.type !== 'Polygon' || !clienteArea.coordinates?.length) return;

    try {
      const coords = clienteArea.coordinates[0].map(([lng, lat]: [number, number]) => [lat, lng] as [number, number]);
      const polygon = L.polygon(coords, {
        color: 'hsl(210, 80%, 55%)',
        weight: 2.5,
        fillOpacity: 0.08,
        dashArray: '8 5',
      });
      polygon.bindTooltip('Área Urbana', { sticky: true, direction: 'top' });
      polygon.addTo(map);
      clienteAreaLayerRef.current = polygon;
    } catch (err) {
      console.error('Erro ao renderizar área do cliente:', err);
    }
  }, [clienteArea]);

  // Theme swap — no longer swaps tiles automatically since user controls it

  // Render planejamento polygons + legend
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    try {
      if (document.body.contains(map.getContainer?.())) map.closePopup?.();
    } catch (_) { /* ignore */ }
    const group = planejamentoLayerRef.current;
    group.clearLayers();

    // Remove previous plan legend
    if (planLegendRef.current) {
      map.removeControl(planLegendRef.current);
      planLegendRef.current = null;
    }

    if (!showPlanejamentos || !planejamentos?.length) return;

    const legendItems: { label: string; color: string }[] = [];

    planejamentos.forEach((p, idx) => {
      if (!p.area) return;
      try {
        const geojson = p.area;
        if (geojson.type === 'Polygon' && geojson.coordinates?.length > 0) {
          const color = PLAN_COLORS[idx % PLAN_COLORS.length];
          const coords = geojson.coordinates[0].map(([lng, lat]: [number, number]) => [lat, lng] as [number, number]);
          const polygon = L.polygon(coords, {
            color,
            weight: 2.5,
            fillOpacity: 0.12,
            dashArray: '6 4',
          });
          const label = p.descricao || `Planejamento ${idx + 1}`;
          polygon.bindTooltip(label, {
            sticky: true,
            className: '',
            direction: 'top',
          });
          group.addLayer(polygon);
          legendItems.push({ label, color });
        }
      } catch (err) {
        console.error('Erro ao renderizar polígono de planejamento:', err);
      }
    });

    // Add planejamento legend
    if (legendItems.length > 0) {
      const legend = new L.Control({ position: 'bottomleft' });
      legend.onAdd = () => {
        const div = L.DomUtil.create('div');
        div.innerHTML = `
          <div style="background:hsl(var(--card));border:1px solid hsl(var(--border));border-radius:10px;padding:10px 14px;font-family:inherit;font-size:11px;box-shadow:0 2px 12px rgba(0,0,0,0.12);max-width:200px;">
            <p style="margin:0 0 6px;font-weight:700;font-size:11px;color:hsl(var(--foreground));text-transform:uppercase;letter-spacing:0.05em;">Planejamentos</p>
            ${legendItems.map(r => `
              <div style="display:flex;align-items:center;gap:8px;margin-top:4px;">
                <span style="width:14px;height:4px;border-radius:2px;background:${r.color};flex-shrink:0;"></span>
                <span style="color:hsl(var(--foreground));white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(r.label)}</span>
              </div>
            `).join('')}
          </div>
        `;
        return div;
      };
      legend.addTo(map);
      planLegendRef.current = legend;
    }
  }, [planejamentos, showPlanejamentos]);

  // Render regioes polygons + legend
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    try {
      if (document.body.contains(map.getContainer?.())) map.closePopup?.();
    } catch (_) { /* ignore */ }
    const group = regioesLayerRef.current;
    group.clearLayers();

    if (regioesLegendRef.current) {
      map.removeControl(regioesLegendRef.current);
      regioesLegendRef.current = null;
    }

    if (!showRegioes || !regioes?.length) return;

    const legendItems: { label: string; color: string; classificacao: string }[] = [];
    const defaultColor = 'hsl(210, 15%, 60%)';

    regioes.forEach((r, idx) => {
      if (!r.area) return;
      try {
        const geojson = r.area as PlanejamentoGeoJSON;
        if (geojson.type === 'Polygon' && geojson.coordinates?.length > 0) {
          const risco = pluvioRiscoMap[r.id];
          const classificacao = risco?.classificacao_final ?? 'Sem dados';
          const color = CLASSIFICACAO_COLORS[classificacao] ?? defaultColor;
          const fillOpacity = risco ? 0.25 : 0.08;

          const coords = geojson.coordinates[0].map(([lng, lat]: [number, number]) => [lat, lng] as [number, number]);
          const polygon = L.polygon(coords, {
            color,
            weight: 2.5,
            fillOpacity,
            fillColor: color,
          });

          // Rich tooltip with risk data
          const label = r.regiao || `Região ${idx + 1}`;
          let tooltipContent = `<div style="font-family:inherit;font-size:12px;min-width:160px;">
            <p style="margin:0 0 4px;font-weight:700;font-size:13px;">${escapeHtml(label)}</p>`;

          if (risco) {
            tooltipContent += `
              <div style="display:flex;align-items:center;gap:6px;margin:4px 0;">
                <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color};"></span>
                <span style="font-weight:600;">${escapeHtml(classificacao)}</span>
              </div>
              <div style="font-size:11px;color:hsl(var(--muted-foreground));line-height:1.5;">
                <div>📅 ${risco.dt_ref}</div>
                <div>🌧 24h: ${risco.chuva_24h ?? 0}mm · 72h: ${risco.chuva_72h ?? 0}mm · 7d: ${risco.chuva_7d ?? 0}mm</div>
                <div>📊 Prob: ${risco.prob_final_min ?? '?'}–${risco.prob_final_max ?? '?'}%</div>
                ${risco.tendencia ? `<div>📈 Tendência: ${risco.tendencia}</div>` : ''}
              </div>`;
          } else {
            tooltipContent += `<p style="margin:4px 0 0;font-size:11px;color:hsl(var(--muted-foreground));">Sem dados pluviométricos</p>`;
          }
          tooltipContent += `</div>`;

          polygon.bindTooltip(tooltipContent, { sticky: true, direction: 'top' });
          group.addLayer(polygon);
          legendItems.push({ label, color, classificacao });
        }
      } catch (err) {
        console.error('Erro ao renderizar polígono de região:', err);
      }
    });

    if (legendItems.length > 0) {
      const legend = new L.Control({ position: 'bottomleft' });
      legend.onAdd = () => {
        const div = L.DomUtil.create('div');
        div.style.marginBottom = '8px';
        div.innerHTML = `
          <div style="background:hsl(var(--card));border:1px solid hsl(var(--border));border-radius:10px;padding:10px 14px;font-family:inherit;font-size:11px;box-shadow:0 2px 12px rgba(0,0,0,0.12);max-width:220px;">
            <p style="margin:0 0 6px;font-weight:700;font-size:11px;color:hsl(var(--foreground));text-transform:uppercase;letter-spacing:0.05em;">Regiões — Risco</p>
            ${legendItems.map(r => `
              <div style="display:flex;align-items:center;gap:8px;margin-top:4px;">
                <span style="width:12px;height:12px;border-radius:3px;background:${r.color};flex-shrink:0;opacity:0.8;"></span>
                <span style="color:hsl(var(--foreground));white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;">${escapeHtml(r.label)}</span>
                <span style="font-size:10px;font-weight:600;color:${r.color};white-space:nowrap;">${escapeHtml(r.classificacao)}</span>
              </div>
            `).join('')}
          </div>
        `;
        return div;
      };
      legend.addTo(map);
      regioesLegendRef.current = legend;
    }
  }, [regioes, showRegioes, pluvioRiscoMap]);

  // Render items based on mode
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    try {
      if (document.body.contains(map.getContainer?.())) map.closePopup?.();
    } catch (_) { /* ignore */ }

    // Clear previous layers
    if (markersLayerRef.current) {
      map.removeLayer(markersLayerRef.current);
      markersLayerRef.current = null;
    }
    if (heatLayerRef.current) {
      map.removeLayer(heatLayerRef.current);
      heatLayerRef.current = null;
    }

    const bounds: LatLngTuple[] = [];

    if (mode === 'heatmap') {
      const heatPoints: [number, number, number][] = [];

      items.forEach((item) => {
        if (item.latitude == null || item.longitude == null) return;
        bounds.push([item.latitude, item.longitude]);
        const weight = RISK_WEIGHT[normalizeRiskBucket(item.risco)] ?? 0.3;
        heatPoints.push([item.latitude, item.longitude, weight]);
      });

      if (heatPoints.length > 0) {
        const r = heatmapConfig?.radius ?? 25;
        const b = heatmapConfig?.blur ?? 15;
        heatLayerRef.current = (L as typeof L & { heatLayer: (pts: unknown[], opts: Record<string, unknown>) => L.Layer }).heatLayer(heatPoints, {
          radius: r,
          blur: b,
          maxZoom: 17,
          max: 1.0,
          gradient: {
            0.2: '#22c55e',
            0.4: '#eab308',
            0.6: '#f97316',
            0.8: '#ef4444',
            1.0: '#991b1b',
          },
        }).addTo(map);
      }
    } else {
      // Cluster mode
      const clusterGroup = L.markerClusterGroup({
        maxClusterRadius: 50,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        zoomToBoundsOnClick: true,
        iconCreateFunction: (cluster) => {
          const count = cluster.getChildCount();
          const sz = count >= 100 ? 44 : count >= 10 ? 36 : 28;
          return L.divIcon({
            html: `<div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;font-size:12px;font-weight:700;color:hsl(var(--primary-foreground));background:hsl(var(--primary));border-radius:9999px;box-shadow:0 2px 8px rgba(0,0,0,0.3);">${count}</div>`,
            className: '',
            iconSize: L.point(sz, sz),
          });
        },
      }).addTo(map);
      markersLayerRef.current = clusterGroup;

      items.forEach((item) => {
        if (item.latitude == null || item.longitude == null) return;
        const position: LatLngTuple = [item.latitude, item.longitude];
        bounds.push(position);
        const marker = L.marker(position, { icon: createMarkerIcon(item) });
        marker.bindPopup(popupHtml(item), { maxWidth: 280 });

        marker.on('click', () => {
          if (onItemClick) onItemClick(item);
        });

        marker.addTo(clusterGroup);
      });
    }

    if (bounds.length > 1) {
      map.fitBounds(bounds, { padding: [28, 28] });
    } else {
      map.setView(center as LatLngExpression, 13);
    }
  }, [items, center, mode, heatmapConfig, onItemClick]);

  return <div ref={mapNodeRef} className="h-full w-full rounded-xl" />;
};

export default InspectionLeafletMap;
