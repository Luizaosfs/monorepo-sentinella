import InspectionLeafletMap, { type LeafletMap, type MapMode, type PlanejamentoGeoJSON, type PlanejamentoPolygon, type RegiaoPolygon } from '@/components/map/InspectionLeafletMap';
import { LevantamentoItem, PluvioRisco } from '@/types/database';

interface Props {
  items: LevantamentoItem[];
  center: [number, number];
  mode: MapMode;
  clienteArea: PlanejamentoGeoJSON | null;
  planejamentos: PlanejamentoPolygon[];
  regioes: RegiaoPolygon[];
  pluvioRiscoMap: Record<string, PluvioRisco>;
  onMapReady: (map: LeafletMap) => void;
  onItemClick: (item: LevantamentoItem) => void;
}

export function MapView({ 
  items, center, mode, clienteArea, planejamentos, regioes, pluvioRiscoMap, onMapReady, onItemClick 
}: Props) {
  return (
    <div className="flex-1 relative w-full h-full min-h-0 bg-background/50">
      <div className="absolute inset-0 z-0">
        <InspectionLeafletMap
          items={items}
          center={center}
          mode={mode}
          heatmapConfig={{ radius: 25, blur: 15 }}
          planejamentos={planejamentos}
          showPlanejamentos={true}
          regioes={regioes}
          showRegioes={true}
          pluvioRiscoMap={pluvioRiscoMap}
          clienteArea={clienteArea}
          onMapReady={onMapReady}
          onItemClick={onItemClick}
        />
      </div>
      {/* Dark overlay to simulate Palantir/Tesla dark map contrast if the base tiles are light */}
      {/* Assuming the tileLayerControl in InspectionLeafletMap already handles dark theme, this is optional. 
          If further contrast is needed, we could add a pointer-events-none div here:
          <div className="absolute inset-0 pointer-events-none bg-black/10 mix-blend-multiply z-[300]" />
      */}
    </div>
  );
}
