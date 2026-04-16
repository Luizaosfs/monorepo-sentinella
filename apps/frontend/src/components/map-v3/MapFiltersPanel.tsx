import { Filter, Calendar, AlertTriangle, ShieldCheck, Clock, CheckCircle2, X, PanelLeftClose } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { MapKpiRow } from "./MapKpiRow";
import { cn } from "@/lib/utils";

interface Props {
  stats: { total: number; alto: number; medio: number; baixo: number };
  filterRisk: string[];
  setFilterRisk: (r: string[]) => void;
  filterType: string[];
  setFilterType: (t: string[]) => void;
  dateRange: string;
  setDateRange: (r: string) => void;
  uniqueTypes: string[];
  open?: boolean;
  onClose?: () => void;
  onDesktopCollapse?: () => void;
}

const RISK_LEVELS = [
  { id: 'alto', label: 'Alto risco', color: 'bg-red-500/20 text-red-500 border-red-500/30' },
  { id: 'medio', label: 'Médio risco', color: 'bg-orange-500/20 text-orange-500 border-orange-500/30' },
  { id: 'baixo', label: 'Baixo risco', color: 'bg-emerald-500/20 text-emerald-500 border-emerald-500/30' },
];

export function MapFiltersPanel({ stats, filterRisk, setFilterRisk, filterType, setFilterType, dateRange, setDateRange, uniqueTypes, open, onClose, onDesktopCollapse }: Props) {

  const toggleRisk = (id: string) => {
    if (filterRisk.includes(id)) {
      setFilterRisk(filterRisk.filter(r => r !== id));
    } else {
      setFilterRisk([...filterRisk, id]);
    }
  };

  const toggleType = (t: string) => {
    if (filterType.includes(t)) {
      setFilterType(filterType.filter(x => x !== t));
    } else {
      setFilterType([...filterType, t]);
    }
  };

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
        "bg-card shadow-xl border-border/60 z-[500] flex flex-col shrink-0",
        // Mobile: bottom sheet
        "fixed bottom-0 inset-x-0 rounded-t-2xl border-t transition-transform duration-300 ease-in-out",
        open ? "translate-y-0" : "translate-y-full",
        // Desktop: static left sidebar
        "lg:static lg:translate-y-0 lg:w-[320px] lg:h-full lg:rounded-none lg:border-t-0 lg:border-r"
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
      <div className="hidden lg:flex items-center justify-between p-5 border-b border-border/60 bg-muted/20">
        <div>
          <h2 className="text-lg font-bold text-foreground">Filtros</h2>
          <p className="text-xs text-muted-foreground mt-1">Mapa Operacional</p>
        </div>
        {onDesktopCollapse && (
          <button
            type="button"
            onClick={onDesktopCollapse}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            title="Ocultar painel"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar max-h-[65vh] lg:max-h-none">
        {/* KPIs */}
        <MapKpiRow {...stats} />

        {/* Date Filters */}
        <div className="space-y-3">
          <h3 className="text-[11px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            Período
          </h3>
          <div className="flex bg-muted/40 p-1 rounded-xl border border-border/40">
            {['hoje', '7d', '30d'].map((val) => (
              <button 
                key={val}
                onClick={() => setDateRange(val)}
                className={`flex-1 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  dateRange === val 
                    ? 'bg-background shadow-sm text-foreground ring-1 ring-border/50' 
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                }`}
              >
                {val === 'hoje' ? 'Hoje' : val === '7d' ? '7 dias' : '30 dias'}
              </button>
            ))}
          </div>
        </div>

        {/* Risk Filters */}
        <div className="space-y-3">
          <h3 className="text-[11px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" />
            Risco
          </h3>
          <div className="flex flex-col gap-2">
            {RISK_LEVELS.map(risk => {
              const isActive = filterRisk.includes(risk.id);
              return (
                <Badge
                  key={risk.id}
                  variant="outline"
                  onClick={() => toggleRisk(risk.id)}
                  className={`cursor-pointer border text-xs px-3 py-2 shadow-none transition-all duration-200 border-border/60 bg-transparent text-muted-foreground font-semibold hover:bg-muted/40 w-full flex justify-center ${
                    isActive ? risk.color + " !border-transparent scale-[1.02] shadow-sm ring-1 ring-border/50" : ""
                  }`}
                >
                  {risk.label}
                </Badge>
              )
            })}
          </div>
        </div>

        {/* Type Filters (Dynamic) */}
        {uniqueTypes.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-[11px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5" />
              Tipo
            </h3>
            <div className="space-y-2.5 bg-muted/20 p-3 rounded-xl border border-border/40">
              {uniqueTypes.map(type => (
                <div key={type} className="flex items-center space-x-3 group text-sm cursor-pointer" onClick={() => toggleType(type)}>
                  <Checkbox 
                    id={type} 
                    checked={filterType.includes(type)}
                    onCheckedChange={() => toggleType(type)}
                    className="rounded bg-background data-[state=checked]:bg-primary"
                  />
                  <label
                    htmlFor={type}
                    className="font-medium text-foreground cursor-pointer group-hover:text-primary transition-colors flex-1 capitalize truncate"
                  >
                    {type}
                  </label>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SLA Summary Placeholder */}
        <div className="space-y-3 pt-4 border-t border-border/60">
          <h3 className="text-[11px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" />
            Extrato SLA
          </h3>
          <div className="space-y-2">
             <div className="flex items-center justify-between p-2 rounded-xl text-xs font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 border-l-4">
                <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4"/>Dentro do SLA</div>
                <span>--</span>
             </div>
             <div className="flex items-center justify-between p-2 rounded-xl text-xs font-semibold bg-orange-500/10 text-orange-500 border border-orange-500/20 border-l-4">
                <div className="flex items-center gap-2"><Clock className="w-4 h-4"/>Vencendo</div>
                <span>--</span>
             </div>
             <div className="flex items-center justify-between p-2 rounded-xl text-xs font-semibold bg-red-500/10 text-red-500 border border-red-500/20 border-l-4">
                <div className="flex items-center gap-2"><AlertTriangle className="w-4 h-4"/>Vencido</div>
                <span>--</span>
             </div>
          </div>
        </div>

      </div>
    </div>
    </>
  );
}
