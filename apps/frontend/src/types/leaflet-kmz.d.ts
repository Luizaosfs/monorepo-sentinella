declare module 'leaflet-kmz' {
  import * as L from 'leaflet';

  module 'leaflet' {
    function kmzLayer(options?: Record<string, unknown>): unknown;
  }
}
