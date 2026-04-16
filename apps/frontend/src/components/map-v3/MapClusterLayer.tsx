import { useEffect, useRef, useMemo } from 'react';
import L from '@/lib/leaflet';
import { useMap } from 'react-leaflet';
import { LevantamentoItem } from '@/types/database';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

function escapeHtml(input: string) {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

const RISK_COLORS: Record<string, string> = {
  critico: '#ef4444',
  alto:    '#ef4444',
  medio:   '#f97316',
  baixo:   '#10b981',
};

const STATUS_COLORS: Record<string, string> = {
  em_atendimento: '#3b82f6',
  resolvido:      '#9ca3af',
};

function getPinColor(item: LevantamentoItem): string {
  const s = item.status_atendimento;
  if (s && STATUS_COLORS[s]) return STATUS_COLORS[s];
  return RISK_COLORS[(item.risco || '').toLowerCase()] ?? '#9ca3af';
}

interface MapClusterLayerProps {
  items: LevantamentoItem[];
  selectedItemId: string | null;
  onMarkerClick: (item: LevantamentoItem) => void;
  itemStatuses?: Record<string, string>;
}

/** Cluster icon: emerald base, translucent white border, glow, hover scale */
function createClusterIcon(cluster: L.MarkerCluster) {
  const count = cluster.getChildCount();
  const size = count >= 100 ? 52 : count >= 10 ? 44 : 36;
  return L.divIcon({
    className: 'sentinella-cluster-icon',
    html: `
      <div class="sentinella-cluster-inner" style="
        width:${size}px;height:${size}px;
        background:#059669;
        border:2px solid rgba(255,255,255,0.6);
        border-radius:50%;
        box-shadow: 0 0 0 2px rgba(5,150,105,0.3), 0 4px 14px rgba(5,150,105,0.4);
        display:flex;align-items:center;justify-content:center;
        font-size:${count >= 100 ? 13 : count >= 10 ? 12 : 11}px;
        font-weight:700;
        color:#fff;
        transition: transform 0.2s ease, box-shadow 0.2s ease;
      ">
        ${count}
      </div>
    `,
    iconSize: L.point(size, size),
    iconAnchor: L.point(size / 2, size / 2),
  });
}

export function MapClusterLayer({
  items,
  selectedItemId,
  onMarkerClick,
  itemStatuses = {},
}: MapClusterLayerProps) {
  const map = useMap();
  const clusterGroupRef = useRef<L.MarkerClusterGroup | null>(null);

  const itemsWithCoords = useMemo(
    () => items.filter((i) => i.latitude != null && i.longitude != null),
    [items]
  );

  useEffect(() => {
    if (!map) return;

    let cancelled = false;

    async function setupClusterLayer() {
      // Carrega o plugin somente no cliente, depois que Leaflet já registrou window.L
      await import('leaflet.markercluster');
      if (cancelled) return;

      const clusterGroup = L.markerClusterGroup({
        maxClusterRadius: 55,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        zoomToBoundsOnClick: true,
        iconCreateFunction: createClusterIcon,
      });

      itemsWithCoords.forEach((item) => {
        const lat = item.latitude!;
        const lng = item.longitude!;
        const statusAtend = item.status_atendimento ?? 'pendente';
        const color = getPinColor(item);
        const statusLabel =
          statusAtend === 'em_atendimento'
            ? 'Em atendimento'
            : statusAtend === 'resolvido'
              ? 'Resolvido'
              : 'Pendente';

        const isSelected = item.id === selectedItemId;
        const isResolved = statusAtend === 'resolvido';
        const size = isSelected ? 22 : 18;
        const anchor = size / 2;

        // Status badge SVG — mostrado só quando em_atendimento (resolvido já fica cinza, pendente sem badge)
        let statusBadge = '';
        if (statusAtend === 'resolvido') {
          statusBadge = `<div style="position:absolute;top:-4px;right:-4px;width:14px;height:14px;background:#9ca3af;border:2px solid #fff;border-radius:50%;display:flex;align-items:center;justify-content:center;">
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          </div>`;
        } else if (statusAtend === 'em_atendimento') {
          statusBadge = `<div style="position:absolute;top:-4px;right:-4px;width:14px;height:14px;background:#3b82f6;border:2px solid #fff;border-radius:50%;display:flex;align-items:center;justify-content:center;">
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5" fill="#fff" stroke="none"/></svg>
          </div>`;
        }

        const el = document.createElement('div');
        el.className = 'sentinella-marker';
        el.style.cssText = `position:relative;width:${size}px;height:${size}px;`;
        el.style.opacity = isResolved ? '0.55' : '1';
        el.innerHTML = `<div style="
          width:${size}px;height:${size}px;
          background:${color};
          border:2px solid rgba(255,255,255,${isSelected ? '0.9' : '0.85'});
          border-radius:50%;
          box-shadow:${isSelected
            ? `0 0 0 3px rgba(255,255,255,0.3), 0 2px 8px rgba(0,0,0,0.35), 0 0 12px ${color}99`
            : '0 2px 8px rgba(0,0,0,0.35)'};
          cursor:pointer;
          transition:transform 0.15s ease, box-shadow 0.15s ease;
        "></div>${statusBadge}`;

        const innerEl = el.firstElementChild as HTMLElement;

        const marker = L.marker([lat, lng], {
          icon: L.divIcon({
            className: '',
            html: el,
            iconSize: [size + 8, size + 8],
            iconAnchor: [anchor + 4, anchor + 4],
          }),
        });

        innerEl.addEventListener('mouseenter', () => {
          innerEl.style.transform = 'scale(1.35)';
          innerEl.style.boxShadow = `0 0 0 4px rgba(255,255,255,0.4), 0 4px 12px ${color}99`;
        });
        innerEl.addEventListener('mouseleave', () => {
          innerEl.style.transform = 'scale(1)';
          if (item.id === selectedItemId) {
            innerEl.style.boxShadow = `0 0 0 3px rgba(255,255,255,0.3), 0 2px 8px rgba(0,0,0,0.35), 0 0 12px ${color}99`;
          } else {
            innerEl.style.boxShadow = '0 2px 8px rgba(0,0,0,0.35)';
          }
        });

        marker.on('click', () => onMarkerClick(item));
        marker.bindTooltip(
          `
          <div style="font-family:inherit;font-size:12px;line-height:1.25;min-width:190px;max-width:240px;">
            <div style="font-weight:800;margin-bottom:4px;">
              ${escapeHtml(item.endereco_curto ?? item.item ?? 'Sem endereço')}
            </div>
            <div style="font-size:11px;color:rgba(55,65,81,1);">
              <div style="margin-bottom:2px;">Status: <span style="font-weight:700;">${escapeHtml(statusLabel)}</span></div>
              <div style="margin-bottom:2px;">Risco: <span style="font-weight:700;">${escapeHtml((item.risco ?? 'Sem risco') as string)}</span></div>
              <div>Prioridade: <span style="font-weight:700;">${escapeHtml((item.prioridade ?? '—') as string)}</span></div>
            </div>
          </div>
        `.trim(),
          {
            direction: 'top',
            offset: [0, -size],
            opacity: 0.95,
            sticky: false,
          },
        );

        clusterGroup.addLayer(marker);
      });

      clusterGroup.addTo(map);
      clusterGroupRef.current = clusterGroup;
    }

    setupClusterLayer();

    return () => {
      cancelled = true;
      if (clusterGroupRef.current) {
        clusterGroupRef.current.removeFrom(map);
        clusterGroupRef.current.clearLayers();
        clusterGroupRef.current = null;
      }
    };
  }, [map, itemsWithCoords, selectedItemId, onMarkerClick, itemStatuses]);

  return null;
}
