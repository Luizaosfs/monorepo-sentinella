declare module 'leaflet.heat' {
  import * as L from 'leaflet';
  export interface HeatLayerOptions {
    minOpacity?: number;
    maxZoom?: number;
    max?: number;
    radius?: number;
    blur?: number;
    gradient?: Record<number, string>;
  }
  export function heatLayer(
    latlngs: Array<[number, number] | [number, number, number]>,
    options?: HeatLayerOptions
  ): L.Layer;
}

declare namespace L {
  function heatLayer(
    latlngs: Array<[number, number] | [number, number, number]>,
    options?: Record<string, unknown>
  ): L.Layer;
}
