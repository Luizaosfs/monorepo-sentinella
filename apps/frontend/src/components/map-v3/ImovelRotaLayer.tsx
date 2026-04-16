import { useEffect } from 'react';
import L from 'leaflet';
import type { StatusVistoria } from '@/types/database';
import type { Imovel } from '@/types/database';

export const IMOVEL_STATUS_CONFIG = {
  visitado: {
    color: '#16a34a',
    badge: 'check' as const,
    label: 'Visitado e Tratado',
    opacity: 1,
  },
  revisita: {
    color: '#f59e0b',
    badge: 'exclamation' as const,
    label: 'Fechado / Pendência',
    opacity: 1,
  },
  recusa: {
    color: '#ef4444',
    badge: 'x' as const,
    label: 'Recusa de acesso',
    opacity: 1,
  },
  fechado: {
    color: '#6b7280',
    badge: 'exclamation' as const,
    label: 'Fechado',
    opacity: 1,
  },
  pendente: {
    color: '#9ca3af',
    badge: 'none' as const,
    label: 'Pendente',
    opacity: 0.85,
  },
  none: {
    color: '#9ca3af',
    badge: 'none' as const,
    label: 'Pendente',
    opacity: 0.85,
  },
} as const;

type BadgeType = 'check' | 'exclamation' | 'x' | 'none';

function createTearDropPin(
  color: string,
  badge: BadgeType,
  isSelected = false,
  hasAlerta = false,
): L.DivIcon {
  const size = isSelected ? 36 : 28;

  const badgeSvg =
    badge === 'check'
      ? `<polyline points="7 13 11 17 17 9" stroke="#fff" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
      : badge === 'exclamation'
      ? `<line x1="12" y1="8" x2="12" y2="13" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/><circle cx="12" cy="16" r="1.2" fill="#fff"/>`
      : badge === 'x'
      ? `<line x1="8" y1="9" x2="16" y2="17" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/><line x1="16" y1="9" x2="8" y2="17" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/>`
      : '';

  const cx = size / 2;
  const cy = size * 0.38;
  const r = size * 0.4;
  const pinPath = `M${cx} ${size - 2} C${cx} ${size - 2} ${size * 0.1} ${size * 0.65} ${size * 0.1} ${size * 0.38} a${r} ${r} 0 1 1 ${size * 0.8} 0 C${size * 0.9} ${size * 0.65} ${cx} ${size - 2} ${cx} ${size - 2}Z`;

  const scale = size / 24;
  const badgeScaled =
    badge !== 'none'
      ? `<g transform="scale(${scale}) translate(0, -2)">${badgeSvg}</g>`
      : '';

  const shadow = isSelected
    ? `filter: drop-shadow(0 0 6px ${color}aa);`
    : `filter: drop-shadow(0 2px 4px rgba(0,0,0,0.35));`;

  const alertaRing = hasAlerta
    ? `<div style="
        position:absolute;
        top:50%;left:50%;
        transform:translate(-50%, -50%);
        width:${size + 10}px;height:${size + 10}px;
        border-radius:50%;
        border:2px solid #f97316;
        animation:retorno-pulse 1.5s ease-in-out infinite;
        pointer-events:none;
      "></div>`
    : '';

  const html = `
    <div style="position:relative;width:${size}px;height:${size}px;${shadow}">
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
        <path d="${pinPath}" fill="${color}" stroke="rgba(255,255,255,0.8)" stroke-width="1.5"/>
        ${badgeScaled}
      </svg>
      ${alertaRing}
    </div>
  `.trim();

  return L.divIcon({
    className: '',
    html,
    iconSize: [size, size],
    iconAnchor: [size / 2, size - 2],
    popupAnchor: [0, -size],
  });
}

interface Props {
  map: L.Map | null;
  imoveis: Imovel[];
  statusPorImovel: Map<string, StatusVistoria | 'none'>;
  selectedId?: string | null;
  quarteiroes?: string[];
  alertasRetornoIds?: Set<string>;
  onImovelClick?: (imovel: Imovel) => void;
}

export function ImovelRotaLayer({
  map,
  imoveis,
  statusPorImovel,
  selectedId,
  quarteiroes = [],
  alertasRetornoIds = new Set(),
  onImovelClick,
}: Props) {
  useEffect(() => {
    if (!map) return;

    const layers: L.Layer[] = [];

    // Add pulse animation CSS once
    if (!document.getElementById('retorno-pulse-style')) {
      const style = document.createElement('style');
      style.id = 'retorno-pulse-style';
      style.textContent = `
        @keyframes retorno-pulse {
          0%, 100% { opacity: 0.6; transform: translate(-50%, -50%) scale(1); }
          50% { opacity: 1; transform: translate(-50%, -50%) scale(1.15); }
        }
      `;
      document.head.appendChild(style);
    }

    // Bounding boxes for assigned quarteirões
    const imoveisPorQuarteirao = new Map<string, Imovel[]>();
    for (const im of imoveis) {
      if (
        im.quarteirao &&
        quarteiroes.includes(im.quarteirao) &&
        im.latitude != null &&
        im.longitude != null
      ) {
        if (!imoveisPorQuarteirao.has(im.quarteirao)) {
          imoveisPorQuarteirao.set(im.quarteirao, []);
        }
        imoveisPorQuarteirao.get(im.quarteirao)!.push(im);
      }
    }

    imoveisPorQuarteirao.forEach((ims, q) => {
      const lats = ims.map((i) => i.latitude!);
      const lngs = ims.map((i) => i.longitude!);
      const bounds: L.LatLngBoundsExpression = [
        [Math.min(...lats) - 0.0003, Math.min(...lngs) - 0.0003],
        [Math.max(...lats) + 0.0003, Math.max(...lngs) + 0.0003],
      ];
      const rect = L.rectangle(bounds, {
        color: '#16a34a',
        weight: 2.5,
        fillColor: '#16a34a',
        fillOpacity: 0.04,
        dashArray: '6 4',
      }).bindTooltip(`Quarteirão ${q}`, { permanent: false });
      rect.addTo(map);
      layers.push(rect);
    });

    // Markers
    for (const im of imoveis) {
      if (im.latitude == null || im.longitude == null) continue;

      const status = statusPorImovel.get(im.id) ?? 'none';
      const cfg = IMOVEL_STATUS_CONFIG[status] ?? IMOVEL_STATUS_CONFIG.none;
      const isSelected = im.id === selectedId;
      const hasAlerta = alertasRetornoIds.has(im.id);

      const icon = createTearDropPin(cfg.color, cfg.badge, isSelected, hasAlerta);
      const marker = L.marker([im.latitude, im.longitude], { icon, opacity: cfg.opacity });

      marker.bindPopup(
        `<div style="min-width:140px">
          <p style="font-weight:700;font-size:13px;margin:0 0 2px">${im.logradouro ?? ''} ${im.numero ?? ''}</p>
          <p style="font-size:11px;color:#666;margin:0 0 4px">${im.bairro ?? ''}</p>
          <span style="font-size:11px;font-weight:600;color:${cfg.color}">${cfg.label}</span>
        </div>`,
        { closeButton: false, maxWidth: 200 },
      );

      if (onImovelClick) {
        marker.on('click', () => onImovelClick(im));
      }

      marker.addTo(map);
      layers.push(marker);
    }

    return () => {
      layers.forEach((l) => map.removeLayer(l));
    };
  }, [map, imoveis, statusPorImovel, selectedId, quarteiroes, alertasRetornoIds, onImovelClick]);

  return null;
}
