import { Search, Layers3, FileDown, Maximize2, Flame } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/hooks/useTheme';

interface MapToolbarProps {
  heatmapEnabled?: boolean;
  onToggleHeatmap?: (v: boolean) => void;
  onExport?: () => void;
  onFullscreen?: () => void;
}

export function MapToolbar({
  heatmapEnabled = false,
  onToggleHeatmap,
  onExport,
  onFullscreen,
}: MapToolbarProps) {

  const handleFullscreen = () => {
    if (onFullscreen) {
      onFullscreen();
      return;
    }
    if (!document.fullscreenElement) {
      const mapWrap = document.querySelector('[data-map-container]');
      if (mapWrap instanceof HTMLElement) {
        mapWrap.requestFullscreen?.();
      }
    } else {
      document.exitFullscreen?.();
    }
  };

  return (
    <div
      className="absolute top-4 left-auto right-4 z-[400] flex items-center gap-2 backdrop-blur-md p-1.5 rounded-xl shadow-xl bg-background/95 border border-border/60 max-w-[calc(100%-2rem)] sm:left-1/2 sm:right-auto sm:-translate-x-1/2"
      data-map-toolbar
    >
      {/* Search — desktop only */}
      <div className="relative hidden lg:block">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Buscar no mapa..."
          className="text-sm w-52 pl-9 pr-3 h-9 rounded-lg focus:ring-2 focus:ring-primary/30 focus:border-primary/40 outline-none text-foreground placeholder:text-muted-foreground bg-muted/40 border border-border/60"
        />
      </div>

      <div className="hidden lg:block w-px h-6 mx-0.5 bg-border/60" />

      {onToggleHeatmap != null && (
        <Button
          variant={heatmapEnabled ? 'default' : 'ghost'}
          size="sm"
          onClick={() => onToggleHeatmap(!heatmapEnabled)}
          className="h-9 px-2 lg:px-3 rounded-lg gap-1.5 font-semibold text-xs border-0 bg-muted/60 hover:bg-muted text-foreground"
          title="Mapa de calor"
        >
          <Flame className="w-4 h-4" />
          <span className="hidden sm:inline">Calor</span>
        </Button>
      )}

      <Button
        variant="ghost"
        size="sm"
        className="h-9 px-2 lg:px-3 rounded-lg gap-1.5 font-semibold text-xs text-muted-foreground cursor-default"
        disabled
        title="Clusters"
      >
        <Layers3 className="w-4 h-4" />
        <span className="hidden sm:inline">Clusters</span>
      </Button>

      <div className="w-px h-6 mx-0.5 bg-border/60" />

      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60"
        onClick={handleFullscreen}
        title="Tela cheia"
      >
        <Maximize2 className="w-4 h-4" />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 rounded-lg text-emerald-500 hover:text-emerald-400 hover:bg-muted/60"
        onClick={onExport}
        title="Exportar dados"
      >
        <FileDown className="w-4 h-4" />
      </Button>
    </div>
  );
}
