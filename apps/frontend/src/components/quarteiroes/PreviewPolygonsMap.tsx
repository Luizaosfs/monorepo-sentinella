import { useEffect, useRef } from 'react';
import L from '@/lib/leaflet';
import 'leaflet/dist/leaflet.css';
import { useTheme } from '@/hooks/useTheme';
import { addTileLayerControl, type TileLayerType } from '@/components/map/tileLayerControl';
import { cn } from '@/lib/utils';

interface PolygonFeature {
  codigo: string;
  geojson: { type: 'Polygon'; coordinates: number[][][] };
}

interface PreviewPolygonsMapProps {
  features: PolygonFeature[];
  backgroundGeoJSON?: Record<string, unknown> | null;
  highlightCodigo?: string | null;
  mapClassName?: string;
}

const PreviewPolygonsMap = ({
  features,
  backgroundGeoJSON,
  highlightCodigo,
  mapClassName,
}: PreviewPolygonsMapProps) => {
  const { theme } = useTheme();
  const mapNodeRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const polygonLayersRef = useRef<Map<string, L.Polygon>>(new Map());
  const backgroundGroupRef = useRef<L.FeatureGroup>(new L.FeatureGroup());
  const featuresGroupRef = useRef<L.FeatureGroup>(new L.FeatureGroup());

  // Init map once
  useEffect(() => {
    if (!mapNodeRef.current || mapRef.current) return;

    const map = L.map(mapNodeRef.current, { zoomControl: true }).setView([-15.78, -47.93], 13);
    mapRef.current = map;

    const initialTile: TileLayerType = theme === 'dark' ? 'dark' : 'street';
    addTileLayerControl(map, initialTile, 'topleft');

    backgroundGroupRef.current.addTo(map);
    featuresGroupRef.current.addTo(map);

    setTimeout(() => map.invalidateSize(), 100);
    setTimeout(() => map.invalidateSize(), 400);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync background region boundary
  useEffect(() => {
    backgroundGroupRef.current.clearLayers();
    if (!backgroundGeoJSON) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const layer = L.geoJSON(backgroundGeoJSON as any, {
        style: { color: '#22c55e', weight: 2.5, fillOpacity: 0.04, dashArray: '8,4' },
      });
      backgroundGroupRef.current.addLayer(layer);
    } catch {
      // ignore render errors
    }
  }, [backgroundGeoJSON]);

  // Sync polygon features
  useEffect(() => {
    const group = featuresGroupRef.current;
    group.clearLayers();
    polygonLayersRef.current.clear();

    const allBounds: L.LatLngBounds[] = [];

    for (const f of features) {
      try {
        const coords = f.geojson.coordinates[0].map(
          ([lng, lat]) => [lat, lng] as [number, number],
        );
        const polygon = L.polygon(coords, {
          color: 'hsl(210,80%,55%)',
          weight: 2,
          fillOpacity: 0.18,
        });
        polygon.bindTooltip(f.codigo, { permanent: false, direction: 'center' });
        group.addLayer(polygon);
        polygonLayersRef.current.set(f.codigo, polygon);
        allBounds.push(polygon.getBounds());
      } catch {
        // skip invalid polygon
      }
    }

    if (mapRef.current && allBounds.length > 0) {
      const combined = allBounds.reduce((acc, b) => acc.extend(b), allBounds[0]);
      mapRef.current.fitBounds(combined, { padding: [40, 40] });
    } else if (mapRef.current && backgroundGeoJSON) {
      // fallback: fit to background
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const layer = L.geoJSON(backgroundGeoJSON as any);
        const b = layer.getBounds();
        if (b.isValid()) mapRef.current.fitBounds(b, { padding: [40, 40] });
      } catch {
        // ignore
      }
    }
  }, [features, backgroundGeoJSON]);

  // Highlight selected polygon
  useEffect(() => {
    polygonLayersRef.current.forEach((layer, codigo) => {
      const isHighlight = codigo === highlightCodigo;
      layer.setStyle({
        color: isHighlight ? '#f59e0b' : 'hsl(210,80%,55%)',
        weight: isHighlight ? 3 : 2,
        fillOpacity: isHighlight ? 0.35 : 0.18,
      });
    });
  }, [highlightCodigo]);

  return (
    <div
      ref={mapNodeRef}
      className={cn('w-full rounded-lg border border-border', mapClassName ?? 'h-[300px]')}
    />
  );
};

export default PreviewPolygonsMap;
