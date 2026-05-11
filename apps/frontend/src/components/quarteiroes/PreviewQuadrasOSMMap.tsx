import { useEffect, useRef } from 'react';
import L from '@/lib/leaflet';
import 'leaflet/dist/leaflet.css';
import type { QuadraCandidataOSM } from '@/hooks/queries/useGestaoQuadras';

interface Props {
  candidatos: QuadraCandidataOSM[];
  selecionadas: Set<string>;
  onToggle: (codigo: string) => void;
  center?: [number, number];
}

const PreviewQuadrasOSMMap = ({ candidatos, selecionadas, onToggle, center }: Props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layersRef = useRef<Record<string, L.Polygon>>({});
  const centerRef = useRef(center);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { zoomControl: true }).setView(centerRef.current ?? [-15.78, -47.93], 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 19,
    }).addTo(map);
    mapRef.current = map;
    let alive = true;
    const t = setTimeout(() => { if (alive) map.invalidateSize(); }, 100);
    return () => { alive = false; clearTimeout(t); map.remove(); mapRef.current = null; };
  }, []);

  // Renderiza polígonos quando candidatos mudam
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    Object.values(layersRef.current).forEach(l => l.remove());
    layersRef.current = {};

    const bounds: L.LatLngBounds[] = [];
    candidatos.forEach((c) => {
      const coords = c.geojson.coordinates[0].map(([lng, lat]) => [lat, lng] as [number, number]);
      const sel = selecionadas.has(c.codigo);
      const poly = L.polygon(coords, {
        color: sel ? '#3b82f6' : '#6b7280',
        fillColor: sel ? '#3b82f6' : '#9ca3af',
        fillOpacity: sel ? 0.3 : 0.15,
        weight: sel ? 2.5 : 1.5,
      }).addTo(map);
      poly.bindTooltip(c.codigo, { permanent: true, direction: 'center', className: 'text-[10px] font-mono' });
      poly.on('click', () => onToggle(c.codigo));
      layersRef.current[c.codigo] = poly;
      bounds.push(poly.getBounds());
    });

    if (bounds.length > 0) {
      map.fitBounds(bounds.reduce((a, b) => a.extend(b)), { padding: [20, 20], animate: false });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidatos]);

  // Atualiza apenas estilos quando seleção muda (sem re-render completo)
  useEffect(() => {
    Object.entries(layersRef.current).forEach(([codigo, poly]) => {
      const sel = selecionadas.has(codigo);
      poly.setStyle({
        color: sel ? '#3b82f6' : '#6b7280',
        fillColor: sel ? '#3b82f6' : '#9ca3af',
        fillOpacity: sel ? 0.3 : 0.15,
        weight: sel ? 2.5 : 1.5,
      });
    });
  }, [selecionadas]);

  return <div ref={containerRef} className="h-[calc(100vh-420px)] min-h-[260px] w-full rounded-lg border" />;
};

export default PreviewQuadrasOSMMap;
