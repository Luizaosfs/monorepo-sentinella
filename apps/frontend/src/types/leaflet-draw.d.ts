import 'leaflet';

declare module 'leaflet' {
  namespace Control {
    class Draw extends Control {
      constructor(options?: Record<string, unknown>);
    }
  }

  namespace Draw {
    class Polygon extends Handler {
      constructor(map: Map, options?: Record<string, unknown>);
    }
    class Event {
      static CREATED: string;
      static EDITED: string;
      static DELETED: string;
    }
  }
}
