/**
 * Leaflet singleton: exporta L e define window.L para plugins (markercluster, heat)
 * que esperam L global. Deve ser importado antes de qualquer plugin em cada módulo.
 */
import L from 'leaflet';

if (typeof window !== 'undefined') {
  (window as unknown as { L: typeof L }).L = L;
}

export default L;
