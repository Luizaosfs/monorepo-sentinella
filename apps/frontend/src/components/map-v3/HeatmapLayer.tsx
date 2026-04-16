import { useEffect, useRef, useMemo, useState } from 'react';
import L from '@/lib/leaflet';
import { useMap, useMapEvents } from 'react-leaflet';
import { LevantamentoItem } from '@/types/database';

const RISK_WEIGHT: Record<string, number> = {
  critico: 1.0,
  alto: 0.8,
  medio: 0.5,
  baixo: 0.25,
};

interface HeatmapLayerProps {
  items: LevantamentoItem[];
  radius?: number;
  blur?: number;
}

export function HeatmapLayer({
  items,
  radius = 25,
  blur = 15,
}: HeatmapLayerProps) {
  const map = useMap();
  const layerRef = useRef<L.Layer | null>(null);

  // QW-08: filtrar pontos pelo viewport atual — evita renderizar itens fora da tela.
  // Padding de 20% garante que pontos na borda do mapa não desaparecem ao mover levemente.
  const [bounds, setBounds] = useState<L.LatLngBounds | null>(() =>
    map ? map.getBounds() : null
  );

  useMapEvents({
    moveend: () => setBounds(map.getBounds()),
    zoomend: () => setBounds(map.getBounds()),
  });

  const points = useMemo(() => {
    const paddedBounds = bounds?.pad(0.2) ?? null;
    const pts: [number, number, number][] = [];
    items.forEach((item) => {
      if (item.latitude == null || item.longitude == null) return;
      if (paddedBounds && !paddedBounds.contains([item.latitude, item.longitude])) return;
      const w = RISK_WEIGHT[(item.risco || '').toLowerCase()] ?? 0.3;
      pts.push([item.latitude, item.longitude, w]);
    });
    return pts;
  }, [items, bounds]);

  useEffect(() => {
    if (!map || points.length === 0) return;

    let cancelled = false;

    async function setupHeatLayer() {
      // Carrega o plugin somente no cliente, depois que Leaflet já registrou window.L
      await import('leaflet.heat');
      if (cancelled) return;

      const heat = (L as unknown as { heatLayer: (p: [number, number, number][], o: Record<string, unknown>) => L.Layer }).heatLayer(
        points,
        {
          radius,
          blur,
          maxZoom: 17,
          max: 1.0,
          gradient: {
            0.2: '#22c55e',
            0.4: '#eab308',
            0.6: '#f97316',
            0.8: '#ef4444',
            1.0: '#991b1b',
          },
        }
      );
      heat.addTo(map);
      layerRef.current = heat;
    }

    setupHeatLayer();

    return () => {
      cancelled = true;
      if (layerRef.current) {
        layerRef.current.removeFrom(map);
        layerRef.current = null;
      }
    };
  }, [map, points, radius, blur]);

  return null;
}
