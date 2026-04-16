import { useEffect, useRef, useCallback } from 'react';
import L from '@/lib/leaflet';
import 'leaflet-draw';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import { useTheme } from '@/hooks/useTheme';
import { addTileLayerControl, type TileLayerType } from '@/components/map/tileLayerControl';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ── Geo helpers ── */
function calcGeodesicArea(latlngs: L.LatLng[]): number {
  // Shoelace on spherical coords (same algo as Leaflet.GeometryUtil)
  const d2r = Math.PI / 180;
  const R = 6378137; // Earth radius in meters
  let area = 0;
  const len = latlngs.length;
  for (let i = 0; i < len; i++) {
    const p1 = latlngs[i];
    const p2 = latlngs[(i + 1) % len];
    area += (p2.lng - p1.lng) * d2r * (2 + Math.sin(p1.lat * d2r) + Math.sin(p2.lat * d2r));
  }
  return Math.abs((area * R * R) / 2);
}

function calcPerimeter(latlngs: L.LatLng[]): number {
  let total = 0;
  for (let i = 0; i < latlngs.length; i++) {
    total += latlngs[i].distanceTo(latlngs[(i + 1) % latlngs.length]);
  }
  return total;
}

function formatArea(m2: number): string {
  const ha = m2 / 10000;
  const m2Formatted = m2.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
  const haFormatted = ha.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${haFormatted} Hectares (${m2Formatted} m²)`;
}

function formatPerimeter(m: number): string {
  const km = m / 1000;
  const mFormatted = m.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
  const kmFormatted = km.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${mFormatted} Metros (${kmFormatted} km)`;
}

interface GeoJSONPolygon {
  type: 'Polygon';
  coordinates: number[][][];
}

interface DrawPolygonMapProps {
  /** GeoJSON Polygon to display initially */
  value: GeoJSONPolygon | null;
  /** Called with GeoJSON Polygon or null when cleared */
  onChange: (geojson: GeoJSONPolygon | null) => void;
  /** Called with area in m² when polygon is drawn/edited, or null when cleared */
  onAreaChange?: (areaM2: number | null) => void;
  /** Called when user clicks on the map (lat, lng) */
  onMapClick?: (lat: number, lng: number) => void;
  /** Map center [lat, lng] */
  center?: [number, number];
  className?: string;
  mapClassName?: string;
  hideLegend?: boolean;
}

// Removed legacy tileUrlByTheme — now using tileLayerControl

const DrawPolygonMap = ({ value, onChange, onAreaChange, onMapClick, center = [-15.78, -47.93], className, mapClassName, hideLegend }: DrawPolygonMapProps) => {
  const { theme } = useTheme();
  const mapNodeRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileControlRef = useRef<{ setTileType: (t: TileLayerType) => void } | null>(null);
  const drawnLayerRef = useRef<L.FeatureGroup>(new L.FeatureGroup());
  const drawControlRef = useRef<L.Control.Draw | null>(null);
  const popupRef = useRef<L.Popup | null>(null);
  const clickMarkerRef = useRef<L.Marker | null>(null);

  const showMeasurementPopup = useCallback((polygon: L.Polygon, map: L.Map) => {
    // Close previous popup
    if (popupRef.current) { map.closePopup(popupRef.current); }

    const latlngs = (polygon.getLatLngs()[0] as L.LatLng[]);
    const area = calcGeodesicArea(latlngs);
    const perimeter = calcPerimeter(latlngs);
    const center = polygon.getBounds().getCenter();
    onAreaChange?.(Math.round(area));

    const popup = L.popup({ closeOnClick: false, autoClose: false, className: 'measurement-popup' })
      .setLatLng(center)
      .setContent(`
        <div style="font-family:system-ui,sans-serif;min-width:200px;">
          <h3 style="margin:0 0 8px;font-size:16px;font-weight:700;">Medida de área</h3>
          <p style="margin:0 0 4px;font-size:13px;">${formatArea(area)}</p>
          <p style="margin:0;font-size:13px;">${formatPerimeter(perimeter)} Perímetro</p>
        </div>
      `)
      .openOn(map);
    popupRef.current = popup;
  }, []);

  // Extract GeoJSON from the feature group
  const emitGeoJSON = useCallback(() => {
    const layers = drawnLayerRef.current.getLayers();
    if (layers.length === 0) {
      onChange(null);
      return;
    }
    // Take the last polygon
    const last = layers[layers.length - 1] as L.Polygon;
    const geojson = last.toGeoJSON();
    onChange(geojson.geometry as GeoJSONPolygon);
  }, [onChange]);

  // Init map
  useEffect(() => {
    if (!mapNodeRef.current || mapRef.current) return;

    const map = L.map(mapNodeRef.current, { zoomControl: true }).setView(center, 13);
    mapRef.current = map;

    const initialTile: TileLayerType = theme === 'dark' ? 'dark' : 'street';
    tileControlRef.current = addTileLayerControl(map, initialTile, 'topleft');

    drawnLayerRef.current.addTo(map);

    // Draw control - polygon only
    const drawControl = new L.Control.Draw({
      position: 'topright',
      draw: {
        polygon: {
          allowIntersection: false,
          shapeOptions: {
            color: 'hsl(210, 80%, 55%)',
            weight: 3,
            fillOpacity: 0.15,
          },
        },
        polyline: false,
        circle: false,
        rectangle: false,
        circlemarker: false,
        marker: false,
      },
      edit: {
        featureGroup: drawnLayerRef.current,
      },
    });
    drawControlRef.current = drawControl;
    map.addControl(drawControl);

    // Events
    map.on(L.Draw.Event.CREATED, (e: L.LeafletEvent) => {
      const event = e as L.LeafletEvent & { layer: L.Layer };
      drawnLayerRef.current.clearLayers();
      drawnLayerRef.current.addLayer(event.layer);
      // Show measurement popup
      showMeasurementPopup(event.layer as L.Polygon, map);
      setTimeout(() => emitGeoJSON(), 0);
    });

    map.on(L.Draw.Event.EDITED, () => {
      setTimeout(() => emitGeoJSON(), 0);
      // Re-show popup for edited polygon
      const layers = drawnLayerRef.current.getLayers();
      if (layers.length > 0) {
        showMeasurementPopup(layers[layers.length - 1] as L.Polygon, map);
      }
    });

    map.on(L.Draw.Event.DELETED, () => {
      setTimeout(() => emitGeoJSON(), 0);
      onAreaChange?.(null);
    });

    // Click on map to get coordinates and show marker
    map.on('click', (e: L.LeafletMouseEvent) => {
      if (onMapClick) {
        onMapClick(e.latlng.lat, e.latlng.lng);
        // Update or create click marker
        if (clickMarkerRef.current) {
          clickMarkerRef.current.setLatLng(e.latlng);
        } else {
          const icon = L.divIcon({
            className: '',
            html: `<div style="width:14px;height:14px;border-radius:50%;background:hsl(210,80%,55%);border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4);"></div>`,
            iconSize: [14, 14],
            iconAnchor: [7, 7],
          });
          clickMarkerRef.current = L.marker(e.latlng, { icon }).addTo(map);
        }
      }
    });

    // Force resize (multiple attempts for lazy-loaded containers)
    setTimeout(() => map.invalidateSize(), 100);
    setTimeout(() => map.invalidateSize(), 400);
    setTimeout(() => map.invalidateSize(), 1000);

    return () => {
      map.remove();
      mapRef.current = null;
      tileControlRef.current = null;
      drawControlRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load initial value
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    const drawn = drawnLayerRef.current;

    drawn.clearLayers();

    if (value && value.type === 'Polygon' && value.coordinates?.length > 0) {
      try {
        // GeoJSON uses [lng, lat], Leaflet uses [lat, lng]
        const coords = value.coordinates[0].map(([lng, lat]) => [lat, lng] as [number, number]);
        const polygon = L.polygon(coords, {
          color: 'hsl(210, 80%, 55%)',
          weight: 3,
          fillOpacity: 0.15,
        });
        drawn.addLayer(polygon);
        map.fitBounds(polygon.getBounds(), { padding: [40, 40] });
        // Show measurement popup for loaded polygon
        setTimeout(() => showMeasurementPopup(polygon, map), 300);
      } catch (err) {
        console.error('Error loading polygon:', err);
      }
    }
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  // Recenter when parent changes center (e.g., cliente loaded/changed) and no polygon is drawn
  useEffect(() => {
    if (!mapRef.current || !center) return;
    const hasPolygon = drawnLayerRef.current.getLayers().length > 0;
    if (hasPolygon) return;
    mapRef.current.setView(center, mapRef.current.getZoom(), { animate: false });
  }, [center]);

  // Theme swap — user controls tiles via the switcher now

  const handleClear = () => {
    drawnLayerRef.current.clearLayers();
    onChange(null);
    onAreaChange?.(null);
  };

  return (
    <div className={className}>
      <div className="relative h-full w-full">
        <div ref={mapNodeRef} className={cn("h-[350px] w-full rounded-lg border border-border", mapClassName)} />
        {drawnLayerRef.current.getLayers().length > 0 && (
          <Button
            type="button"
            variant="destructive"
            size="sm"
            className="absolute top-2 left-2 z-[1000] gap-1.5 shadow-md"
            onClick={handleClear}
          >
            <Trash2 className="w-3.5 h-3.5" />
            Limpar
          </Button>
        )}
      </div>
      {!hideLegend && (
        <p className="text-xs text-muted-foreground mt-1.5">
          {onMapClick
            ? 'Clique no mapa para definir as coordenadas. Use a ferramenta de polígono para desenhar a área.'
            : 'Use a ferramenta de polígono no canto superior direito para desenhar a área no mapa.'}
        </p>
      )}
    </div>
  );
};

export default DrawPolygonMap;
