import { Filter, Calendar, AlertTriangle, MapPin, Target, TrendingUp, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

export interface MapKpiWithDeltas {
  total: number;
  alto: number;
  medio: number;
  baixo: number;
  /** Distinct regions (e.g. by endereco_curto) */
  regioes: number;
  /** Average score_final */
  scoreMedio: number;
  /** Optional: delta vs today (e.g. "+12 hoje") */
  deltaHoje?: string;
  /** Optional: delta vs yesterday (e.g. "-3 vs ontem") */
  deltaOntem?: string;
}

const RISK_LEVELS = [
  { id: 'alto', label: 'Alto risco', color: 'bg-red-500/20 text-red-500 border-red-500/30' },
  { id: 'medio', label: 'Médio risco', color: 'bg-orange-500/20 text-orange-500 border-orange-500/30' },
  { id: 'baixo', label: 'Baixo risco', color: 'bg-emerald-500/20 text-emerald-500 border-emerald-500/30' },
];

interface MapSidebarProps {
  kpis: MapKpiWithDeltas;
  regionFilter: string;
  setRegionFilter: (v: string) => void;
  regions: string[];
  dateRange: string;
  setDateRange: (v: string) => void;
  filterRisk: string[];
  setFilterRisk: (r: string[]) => void;
  filterType: string[];
  setFilterType: (t: string[]) => void;
  uniqueTypes: string[];
  open?: boolean;
  onClose?: () => void;
}

export function MapSidebar({
  kpis,
  regionFilter,
  setRegionFilter,
  regions,
  dateRange,
  setDateRange,
  filterRisk,
  setFilterRisk,
  filterType,
  setFilterType,
  uniqueTypes,
  open,
  onClose,
}: MapSidebarProps) {
  const toggleRisk = (id: string) => {
    if (filterRisk.includes(id)) {
      setFilterRisk(filterRisk.filter((r) => r !== id));
    } else {
      setFilterRisk([...filterRisk, id]);
    }
  };

  const toggleType = (t: string) => {
    if (filterType.includes(t)) {
      setFilterType(filterType.filter((x) => x !== t));
    } else {
      setFilterType([...filterType, t]);
    }
  };

  const kpiCards = [
    {
      label: 'Total Detectados',
      value: kpis.total,
      icon: MapPin,
      delta: kpis.deltaHoje,
      className: 'text-foreground',
    },
    {
      label: 'Pontos Críticos',
      value: kpis.alto,
      icon: AlertTriangle,
      delta: kpis.deltaOntem,
      className: 'text-red-500',
    },
    {
      label: 'Regiões Afetadas',
      value: kpis.regioes,
      icon: Target,
      className: 'text-orange-500',
    },
    {
      label: 'Score Médio',
      value: kpis.scoreMedio != null ? kpis.scoreMedio.toFixed(1) : '—',
      icon: TrendingUp,
      className: 'text-emerald-500',
    },
  ];

  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-[499] bg-black/40 lg:hidden"
          onClick={onClose}
        />
      )}

      <div className={cn(
        "flex flex-col shrink-0 bg-background border-border/60 z-[500]",
        // Mobile: bottom sheet
        "fixed bottom-0 inset-x-0 rounded-t-2xl border-t transition-transform duration-300 ease-in-out",
        open ? "translate-y-0" : "translate-y-full",
        // Desktop: static left sidebar
        "lg:static lg:translate-y-0 lg:w-[320px] lg:h-full lg:rounded-xl lg:border lg:overflow-hidden lg:animate-in lg:fade-in lg:duration-200"
      )}>
      {/* Mobile header */}
      <div className="flex items-center justify-between p-4 border-b border-border/60 lg:hidden">
        <div className="w-10 h-1 bg-border rounded-full absolute left-1/2 -translate-x-1/2 top-2.5" />
        <h2 className="text-base font-bold text-foreground mt-1">Filtros</h2>
        <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-muted hover:bg-muted/80 transition-colors">
          <X className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {/* Desktop header */}
      <div className="hidden lg:block p-4 border-b border-border/60">
        <h2 className="text-lg font-bold text-foreground">Mapa Operacional</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Filtros e indicadores</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5 custom-scrollbar max-h-[65vh] lg:max-h-none">
        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3">
          {kpiCards.map((kpi, idx) => (
            <Card
              key={idx}
              className="rounded-xl border-border/60 bg-card shadow-sm overflow-hidden"
            >
              <CardContent className="p-3">
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground truncate">
                    {kpi.label}
                  </span>
                  <kpi.icon className={`w-3.5 h-3.5 shrink-0 ${kpi.className}`} />
                </div>
                <div className={`text-xl font-black ${kpi.className}`}>{kpi.value}</div>
                {kpi.delta && (
                  <p className="text-[10px] text-muted-foreground mt-0.5 font-medium">
                    {kpi.delta}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <Separator className="bg-border/60" />

        {/* Região */}
        <div className="space-y-2">
          <h3 className="text-[11px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-1.5">
            <Target className="w-3.5 h-3.5" />
            Região
          </h3>
          <Select
          value={regionFilter === 'all' ? 'all' : regionFilter}
          onValueChange={setRegionFilter}
        >
            <SelectTrigger className="rounded-xl border-border bg-background h-9 text-sm">
            <SelectValue placeholder="Todas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as regiões</SelectItem>
              {regions.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Período */}
        <div className="space-y-2">
          <h3 className="text-[11px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            Período
          </h3>
          <div className="flex bg-muted/40 p-1 rounded-xl border border-border/60">
            {[
              { val: 'hoje', label: 'Hoje' },
              { val: '7d', label: '7 dias' },
              { val: '30d', label: '30 dias' },
            ].map(({ val, label }) => (
              <button
                key={val}
                type="button"
                onClick={() => setDateRange(val)}
                className={`flex-1 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  dateRange === val
                  ? 'bg-background text-foreground shadow-sm border border-border/40'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <Separator className="bg-border/60" />

        {/* Risk level chips */}
        <div className="space-y-2">
          <h3 className="text-[11px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" />
            Risco
          </h3>
          <div className="flex flex-col gap-2">
            {RISK_LEVELS.map((risk) => {
              const isActive = filterRisk.includes(risk.id);
              return (
                <Badge
                  key={risk.id}
                  variant="outline"
                  onClick={() => toggleRisk(risk.id)}
                  className={`cursor-pointer border text-xs px-3 py-2 rounded-xl transition-all duration-200 border-border bg-transparent text-muted-foreground font-semibold hover:bg-muted/60 w-full flex justify-center ${
                    isActive ? `${risk.color} border-transparent scale-[1.02]` : ''
                  }`}
                >
                  {risk.label}
                </Badge>
              );
            })}
          </div>
        </div>

        {/* Detection type checkboxes */}
        {uniqueTypes.length > 0 && (
          <>
            <Separator className="bg-border/60" />
            <div className="space-y-2">
              <h3 className="text-[11px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5" />
                Tipo de detecção
              </h3>
              <div className="space-y-2 rounded-xl border border-border/60 bg-muted/30 p-3">
                {uniqueTypes.map((type) => (
                  <div
                    key={type}
                    className="flex items-center space-x-3 group text-sm cursor-pointer"
                    onClick={() => toggleType(type)}
                  >
                    <Checkbox
                      id={type}
                      checked={filterType.includes(type)}
                      onCheckedChange={() => toggleType(type)}
                      className="rounded border-border data-[state=checked]:bg-primary"
                    />
                    <label
                      htmlFor={type}
                      className="font-medium text-foreground cursor-pointer group-hover:text-primary/90 transition-colors flex-1 capitalize truncate"
                    >
                      {type}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
    </>
  );
}
