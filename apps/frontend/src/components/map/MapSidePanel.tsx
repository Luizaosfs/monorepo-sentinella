import { useState, useMemo } from 'react';
import { Search, ArrowUpDown, MapPin, ExternalLink, Navigation } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { LevantamentoItem } from '@/types/database';
import { resolveMediaUrl } from '@/lib/media';
import ItemDetailPanel from '@/components/levantamentos/ItemDetailPanel';

const RISK_ORDER: Record<string, number> = {
  critico: 0,
  alto: 1,
  medio: 2,
  baixo: 3,
};

const riskStyle = (risco: string | null): { bg: string; text: string; border: string } => {
  switch ((risco || '').toLowerCase()) {
    case 'critico': return { bg: 'bg-destructive/10', text: 'text-destructive', border: 'border-destructive/20' };
    case 'alto': return { bg: 'bg-destructive/8', text: 'text-destructive/80', border: 'border-destructive/15' };
    case 'medio': return { bg: 'bg-warning/10', text: 'text-warning', border: 'border-warning/20' };
    case 'baixo': return { bg: 'bg-success/10', text: 'text-success', border: 'border-success/20' };
    default: return { bg: 'bg-muted', text: 'text-muted-foreground', border: 'border-border' };
  }
};

const riskDot = (risco: string | null): string => {
  switch ((risco || '').toLowerCase()) {
    case 'critico': return 'hsl(0, 72%, 45%)';
    case 'alto': return 'hsl(0, 72%, 58%)';
    case 'medio': return 'hsl(38, 92%, 50%)';
    case 'baixo': return 'hsl(152, 69%, 40%)';
    default: return 'hsl(210, 10%, 55%)';
  }
};

type SortMode = 'risk-desc' | 'risk-asc' | 'score-desc' | 'name-asc';

const SORT_LABELS: Record<SortMode, string> = {
  'risk-desc': 'Risco ↓',
  'risk-asc': 'Risco ↑',
  'score-desc': 'Score ↓',
  'name-asc': 'Nome A-Z',
};

const SORT_CYCLE: SortMode[] = ['risk-desc', 'risk-asc', 'score-desc', 'name-asc'];

const RISK_SUMMARY = [
  { key: 'critico', label: 'Crít.' },
  { key: 'alto', label: 'Alto' },
  { key: 'medio', label: 'Méd.' },
  { key: 'baixo', label: 'Baixo' },
];

type MapSidePanelProps = {
  items: LevantamentoItem[];
  onItemClick?: (item: LevantamentoItem) => void;
};

const MapSidePanel = ({ items, onItemClick }: MapSidePanelProps) => {
  const [search, setSearch] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('risk-desc');

  const riskCounts = useMemo(() => {
    return items.reduce((acc, item) => {
      const key = (item.risco || 'indefinido').toLowerCase();
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }, [items]);

  const cycleSort = () => {
    const idx = SORT_CYCLE.indexOf(sortMode);
    setSortMode(SORT_CYCLE[(idx + 1) % SORT_CYCLE.length]);
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    let result = items;

    if (q) {
      result = result.filter(
        (i) =>
          (i.item || '').toLowerCase().includes(q) ||
          (i.endereco_curto || '').toLowerCase().includes(q) ||
          (i.risco || '').toLowerCase().includes(q)
      );
    }

    return [...result].sort((a, b) => {
      switch (sortMode) {
        case 'risk-desc': {
          const ra = RISK_ORDER[(a.risco || '').toLowerCase()] ?? 9;
          const rb = RISK_ORDER[(b.risco || '').toLowerCase()] ?? 9;
          return ra - rb;
        }
        case 'risk-asc': {
          const ra = RISK_ORDER[(a.risco || '').toLowerCase()] ?? 9;
          const rb = RISK_ORDER[(b.risco || '').toLowerCase()] ?? 9;
          return rb - ra;
        }
        case 'score-desc':
          return (b.score_final ?? 0) - (a.score_final ?? 0);
        case 'name-asc':
          return (a.item || '').localeCompare(b.item || '');
        default:
          return 0;
      }
    });
  }, [items, search, sortMode]);

  const handleItemClick = (item: LevantamentoItem) => {
    onItemClick?.(item);
  };

  return (
    <div className="flex flex-col h-full bg-card">
      {/* Header */}
      <div className="p-3 md:p-4 space-y-2.5 md:space-y-3 border-b-2 border-border/40">
        {/* Risk summary mini bar */}
        <div className="flex items-center gap-1.5 md:gap-2">
          {RISK_SUMMARY.map(({ key, label }) => {
            const count = riskCounts[key] || 0;
            if (count === 0) return null;
            return (
              <div
                key={key}
                className="flex items-center gap-1.5 md:gap-2 bg-muted/60 rounded-md md:rounded-lg px-2 py-1.5 md:px-2.5 md:py-2 flex-1 min-w-0"
              >
                <span
                  className="w-2 h-2 md:w-2.5 md:h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: riskDot(key) }}
                />
                <span className="text-[10px] md:text-xs font-bold text-foreground truncate">{count}</span>
                <span className="text-[9px] md:text-[10px] text-muted-foreground truncate hidden sm:inline">{label}</span>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm md:text-base font-bold text-foreground tracking-tight">
              Itens
            </h3>
            <span className="text-[10px] md:text-xs font-bold bg-primary/10 text-primary px-1.5 py-0.5 md:px-2 md:py-1 rounded-md">
              {filtered.length}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 md:h-8 text-[10px] md:text-xs text-muted-foreground hover:text-foreground rounded-md px-2 md:px-3 touch-manipulation"
            onClick={cycleSort}
          >
            <ArrowUpDown className="w-3 h-3 md:w-3.5 md:h-3.5 mr-1" />
            {SORT_LABELS[sortMode]}
          </Button>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 md:left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 md:w-4 md:h-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Buscar item, endereço ou risco..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 md:h-9 pl-8 md:pl-9 text-xs md:text-sm bg-background/50 border-border/60 focus:bg-background rounded-lg"
          />
        </div>
      </div>

      {/* List */}
      <ScrollArea className="flex-1">
        <div className="divide-y divide-border/40">
          {filtered.length === 0 && (
            <div className="p-8 md:p-10 text-center">
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                <Search className="w-4 h-4 md:w-5 md:h-5 text-muted-foreground" />
              </div>
              <p className="text-xs md:text-sm text-muted-foreground font-medium">Nenhum item encontrado</p>
            </div>
          )}
          {filtered.map((item, index) => {
            const risk = riskStyle(item.risco);
            return (
              <button
                key={item.id}
                className="w-full text-left px-3 py-3 md:px-4 md:py-4 hover:bg-muted/60 active:bg-muted transition-all duration-150 focus:outline-none focus:ring-1 focus:ring-ring group relative touch-manipulation"
                onClick={() => handleItemClick(item)}
                style={{ animationDelay: `${Math.min(index * 20, 300)}ms` }}
              >
                {/* Left accent bar */}
                <div
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] md:w-1 h-6 md:h-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                  style={{ backgroundColor: riskDot(item.risco) }}
                />

                <div className="flex gap-3">
                  {resolveMediaUrl(item.image_url) && (
                    <div className="shrink-0 w-12 h-12 md:w-14 md:h-14 rounded-lg overflow-hidden border border-border bg-muted">
                      <img
                        src={resolveMediaUrl(item.image_url)!}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs md:text-sm font-semibold text-foreground leading-tight line-clamp-2 group-hover:text-primary transition-colors duration-150">
                    {item.item || 'Item sem nome'}
                  </p>
                  {item.risco && (
                    <Badge
                      variant="outline"
                      className={`text-[10px] md:text-xs px-1.5 py-0 md:px-2 md:py-0.5 shrink-0 capitalize font-bold border ${risk.bg} ${risk.text} ${risk.border}`}
                    >
                      {item.risco}
                    </Badge>
                  )}
                </div>

                {item.endereco_curto && (
                  <p className="text-[11px] md:text-xs text-muted-foreground mt-1 flex items-center gap-1 line-clamp-1">
                    <MapPin className="w-2.5 h-2.5 md:w-3 md:h-3 shrink-0 text-muted-foreground/60" />
                    {item.endereco_curto}
                  </p>
                )}
                {(item.altitude_m != null || item.drone?.marca) && (
                  <p className="text-[10px] md:text-[11px] text-muted-foreground/80 mt-0.5 line-clamp-1">
                    {[item.altitude_m != null ? `Alt. ${item.altitude_m.toFixed(0)} m` : null, item.drone?.marca ? [item.drone.marca, item.drone.modelo].filter(Boolean).join(' ') : null].filter(Boolean).join(' · ')}
                  </p>
                )}

                <div className="flex items-center gap-2 mt-1.5 md:mt-2 flex-wrap">
                  {item.score_final != null && (
                    <span className="text-[10px] md:text-xs font-mono font-bold text-muted-foreground bg-muted/80 px-1.5 py-0.5 md:px-2 md:py-1 rounded-md">
                      Score {item.score_final}
                    </span>
                  )}
                  {item.latitude != null && item.longitude != null && (
                    <>
                      <a
                        href={`https://www.openstreetmap.org/?mlat=${item.latitude}&mlon=${item.longitude}#map=17/${item.latitude}/${item.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] md:text-xs text-primary/80 hover:text-primary flex items-center gap-0.5 md:gap-1 font-medium transition-colors py-0.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Navigation className="w-2.5 h-2.5 md:w-3 md:h-3" /> OSM
                      </a>
                      <a
                        href={`https://waze.com/ul?ll=${item.latitude},${item.longitude}&navigate=yes`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] md:text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5 md:gap-1 font-medium transition-colors py-0.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink className="w-2.5 h-2.5 md:w-3 md:h-3" /> Waze
                      </a>
                      <a
                        href={`https://www.google.com/maps?q=${item.latitude},${item.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] md:text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5 md:gap-1 font-medium transition-colors py-0.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink className="w-2.5 h-2.5 md:w-3 md:h-3" /> GMaps
                      </a>
                    </>
                  )}
                </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
};

export default MapSidePanel;
