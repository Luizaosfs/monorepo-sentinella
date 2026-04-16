import { Search, Map as MapIcon, Maximize, FileDown, Layers3 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  heatmapMode: boolean;
  onToggleHeatmap: (v: boolean) => void;
  clusterMode: boolean;
  onToggleCluster: (v: boolean) => void;
  onFullscreen: () => void;
  onExport: () => void;
}

export function MapToolbar({ heatmapMode, onToggleHeatmap, clusterMode, onToggleCluster, onFullscreen, onExport }: Props) {
  return (
    <div className="absolute bottom-20 left-4 lg:bottom-auto lg:top-4 lg:left-1/2 lg:-translate-x-1/2 z-[400] flex items-center gap-1.5 bg-card/90 backdrop-blur-md border border-border/60 p-1.5 rounded-2xl shadow-lg">
      {/* Search — desktop only */}
      <div className="relative hidden lg:block">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Buscar local..."
          className="bg-transparent border-none text-sm w-48 pl-9 pr-3 h-9 focus:ring-0 outline-none text-foreground placeholder:text-muted-foreground"
        />
      </div>

      <div className="hidden lg:block w-px h-6 bg-border/60 mx-0.5" />

      <Button
        variant={heatmapMode ? 'default' : 'ghost'}
        size="sm"
        onClick={() => onToggleHeatmap(!heatmapMode)}
        className="h-9 px-2 lg:px-3 rounded-xl gap-1.5 font-semibold text-xs transition-all"
        title="Mapa de calor"
      >
        <MapIcon className="w-4 h-4" />
        <span className="hidden sm:inline">Calor</span>
      </Button>

      <Button
        variant={clusterMode ? 'default' : 'ghost'}
        size="sm"
        onClick={() => onToggleCluster(!clusterMode)}
        className="h-9 px-2 lg:px-3 rounded-xl gap-1.5 font-semibold text-xs transition-all"
        title="Clusters"
      >
        <Layers3 className="w-4 h-4" />
        <span className="hidden sm:inline">Clusters</span>
      </Button>

      <div className="w-px h-6 bg-border/60 mx-0.5" />

      <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-muted/40" onClick={onFullscreen} title="Tela Cheia">
        <Maximize className="w-4 h-4" />
      </Button>

      <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-muted/40" onClick={onExport} title="Exportar Relatório">
        <FileDown className="w-4 h-4 text-emerald-500" />
      </Button>
    </div>
  );
}
