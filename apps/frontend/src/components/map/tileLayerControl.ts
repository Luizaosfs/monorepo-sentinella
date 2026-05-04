import L from 'leaflet';

export type TileLayerType = 'street' | 'satellite' | 'hybrid' | 'terrain' | 'dark';

interface TileConfig {
  label: string;
  url: string;
  attribution: string;
  maxZoom: number;
  subdomains?: string[];
}

/** Mesmos endpoints públicos do proxy `/tiles/*` no backend — URLs absolutas para funcionar no app mobile (Capacitor) quando `VITE_API_URL` está vazio ou o origin não é a API. */
const ESRI_WORLD_IMAGERY =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const ESRI_WORLD_TOPO =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}';

export const TILE_LAYERS: Record<TileLayerType, TileConfig> = {
  street: {
    label: 'Ruas',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
    maxZoom: 19,
  },
  satellite: {
    label: 'Satélite',
    url: ESRI_WORLD_IMAGERY,
    attribution: '&copy; Esri, Maxar, Earthstar Geographics',
    maxZoom: 19,
  },
  hybrid: {
    label: 'Híbrido',
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
    attribution: '&copy; CartoDB',
    maxZoom: 19,
  },
  terrain: {
    label: 'Relevo',
    url: ESRI_WORLD_TOPO,
    attribution: '&copy; Esri, HERE, Garmin, USGS',
    maxZoom: 18,
  },
  dark: {
    label: 'Escuro',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
    attribution: '&copy; CartoDB',
    maxZoom: 19,
  },
};

/**
 * Creates a Leaflet control for switching tile layers.
 * Returns the control and a function to get the current tile layer.
 */
export function addTileLayerControl(
  map: L.Map,
  initialType: TileLayerType = 'street',
  position: L.ControlPosition = 'topright'
): { control: L.Control; tileLayer: L.TileLayer; setTileType: (type: TileLayerType) => void } {
  const config = TILE_LAYERS[initialType];
  let currentTile = L.tileLayer(config.url, {
    attribution: config.attribution,
    maxZoom: config.maxZoom,
    ...(config.subdomains ? { subdomains: config.subdomains } : {}),
  }).addTo(map);

  let currentType = initialType;

  const control = new L.Control({ position });
  control.onAdd = () => {
    const container = L.DomUtil.create('div');
    L.DomEvent.disableClickPropagation(container);
    L.DomEvent.disableScrollPropagation(container);

    const render = () => {
      container.innerHTML = `
        <div style="background:hsl(var(--card));border:1px solid hsl(var(--border));border-radius:8px;padding:4px;font-family:inherit;box-shadow:0 2px 8px rgba(0,0,0,0.15);display:flex;gap:2px;">
          ${(Object.keys(TILE_LAYERS) as TileLayerType[]).map(key => {
            const t = TILE_LAYERS[key];
            const active = key === currentType;
            return `<button data-tile="${key}" style="
              padding:4px 8px;
              border-radius:6px;
              border:none;
              cursor:pointer;
              font-size:11px;
              font-weight:${active ? '700' : '500'};
              background:${active ? 'hsl(var(--primary))' : 'transparent'};
              color:${active ? 'hsl(var(--primary-foreground))' : 'hsl(var(--foreground))'};
              transition:all 0.15s;
              white-space:nowrap;
            ">${t.label}</button>`;
          }).join('')}
        </div>
      `;
    };

    render();

    container.addEventListener('click', (e) => {
      const target = (e.target as HTMLElement).closest('[data-tile]') as HTMLElement | null;
      if (!target) return;
      const type = target.dataset.tile as TileLayerType;
      if (type === currentType) return;

      map.removeLayer(currentTile);
      const cfg = TILE_LAYERS[type];
      currentTile = L.tileLayer(cfg.url, {
        attribution: cfg.attribution,
        maxZoom: cfg.maxZoom,
        ...(cfg.subdomains ? { subdomains: cfg.subdomains } : {}),
      }).addTo(map);
      currentType = type;
      render();
    });

    return container;
  };

  control.addTo(map);

  const setTileType = (type: TileLayerType) => {
    if (type === currentType) return;
    map.removeLayer(currentTile);
    const cfg = TILE_LAYERS[type];
    currentTile = L.tileLayer(cfg.url, {
      attribution: cfg.attribution,
      maxZoom: cfg.maxZoom,
      ...(cfg.subdomains ? { subdomains: cfg.subdomains } : {}),
    }).addTo(map);
    currentType = type;
  };

  return { control, tileLayer: currentTile, setTileType };
}
