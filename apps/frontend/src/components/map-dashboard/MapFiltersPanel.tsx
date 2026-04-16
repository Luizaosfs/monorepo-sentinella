import { MapPin, Filter, AlertTriangle, Calendar, Layers, ShieldCheck, Clock, CheckCircle2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MapStatisticsPanel } from "./MapStatisticsPanel";
import { cn } from "@/lib/utils";

interface Props {
  stats: {
    totalPoints: number;
    criticalPoints: number;
    regionsAffected: number;
    averageScore: number;
  };
  filterRisk: string[];
  setFilterRisk: (r: string[]) => void;
  filterType: string[];
  setFilterType: (t: string[]) => void;
  dateRange: string;
  setDateRange: (r: string) => void;
  region: string;
  setRegion: (r: string) => void;
  regions: {id: string, name: string}[];
  slaStats: {
    safe: number;
    warning: number;
    danger: number;
  };
  uniqueTypes?: string[];
  open?: boolean;
  onClose?: () => void;
}

const RISK_LEVELS = [
  { id: 'critico', label: 'Crítico', color: 'bg-red-500/20 text-red-500 border-red-500/30' },
  { id: 'alto', label: 'Alto', color: 'bg-orange-500/20 text-orange-500 border-orange-500/30' },
  { id: 'medio', label: 'Médio', color: 'bg-yellow-500/20 text-yellow-600 border-yellow-500/30' },
  { id: 'baixo', label: 'Baixo', color: 'bg-emerald-500/20 text-emerald-500 border-emerald-500/30' },
];

const DETECTIONS = [
  { id: 'pneu', label: 'Pneus' },
  { id: 'recipiente', label: 'Recipientes' },
  { id: 'poca', label: 'Poças d\'água' },
  { id: 'lixo', label: 'Lixo / Entulho' },
  { id: 'piscina', label: 'Piscina suja' },
  { id: 'caixa', label: 'Caixa d\'água aberta' },
];

export function MapFiltersPanel({ stats, filterRisk, setFilterRisk, filterType, setFilterType, dateRange, setDateRange, region, setRegion, regions, slaStats, uniqueTypes, open, onClose }: Props) {

  const toggleRisk = (id: string) => {
    if (filterRisk.includes(id)) {
      setFilterRisk(filterRisk.filter(r => r !== id));
    } else {
      setFilterRisk([...filterRisk, id]);
    }
  };

  const toggleType = (id: string) => {
    if (filterType.includes(id)) {
      setFilterType(filterType.filter(t => t !== id));
    } else {
      setFilterType([...filterType, id]);
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
        // Desktop: static left sidebar (overrides mobile)
        "lg:static lg:translate-y-0 lg:w-[320px] lg:h-full lg:rounded-none lg:border-t-0 lg:border-r"
      )}>
      {/* Mobile drag handle */}
      <div className="flex items-center justify-between p-3 border-b border-border/60 lg:hidden">
        <div className="w-10 h-1 bg-border rounded-full mx-auto absolute left-1/2 -translate-x-1/2 top-2.5" />
        <h2 className="text-base font-bold text-primary flex items-center gap-2 mt-1">
          <Layers className="w-4 h-4 text-primary" />
          Filtros
        </h2>
        <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-muted hover:bg-muted/80 transition-colors">
          <X className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {/* Desktop header */}
      <div className="hidden lg:block p-3 border-b border-border/60">
        <h2 className="text-base font-bold text-primary flex items-center gap-2">
          <Layers className="w-4 h-4 text-primary" />
          Controle Operacional
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">Filtros e monitoramento geoespacial</p>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4 custom-scrollbar max-h-[65vh] lg:max-h-none">
        {/* KPIs */}
        <MapStatisticsPanel {...stats} />

        {/* Region Selector */}
        <div className="space-y-2">
          <h3 className="text-[11px] font-black uppercase text-primary tracking-widest flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-primary" />
            Região
          </h3>
          <Select value={region} onValueChange={setRegion}>
            <SelectTrigger className="w-full bg-background border-border/60 rounded-xl h-10 shadow-sm text-sm focus:ring-primary/20">
              <SelectValue placeholder="Todas as regiões" />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-border/60 shadow-lg">
              <SelectItem value="all">Todas as regiões</SelectItem>
              {regions.map(r => (
                <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Date Filters */}
        <div className="space-y-2">
          <h3 className="text-[11px] font-black uppercase text-primary tracking-widest flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-primary" />
            Período
          </h3>
          <div className="flex bg-muted/40 p-1 rounded-xl border border-border/40">
            <button 
              onClick={() => setDateRange('hoje')}
              className={`flex-1 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${dateRange === 'hoje' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Hoje
            </button>
            <button 
              onClick={() => setDateRange('7d')}
              className={`flex-1 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${dateRange === '7d' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              7 dias
            </button>
            <button 
              onClick={() => setDateRange('30d')}
              className={`flex-1 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${dateRange === '30d' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              30 dias
            </button>
          </div>
        </div>

        {/* Risk Filters */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-[11px] font-black uppercase text-primary tracking-widest flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-primary" />
              Nível de Risco
            </h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {RISK_LEVELS.map(risk => {
              const isActive = filterRisk.includes(risk.id);
              return (
                <Badge
                  key={risk.id}
                  variant="outline"
                  onClick={() => toggleRisk(risk.id)}
                  className={`cursor-pointer border text-xs px-3 py-1.5 shadow-none transition-all duration-200 border-border/60 bg-transparent text-muted-foreground font-semibold hover:bg-muted/40 ${
                    isActive ? risk.color + " !border-transparent scale-105" : ""
                  }`}
                >
                  {risk.label}
                </Badge>
              )
            })}
          </div>
        </div>

        {/* Type Filters */}
        <div className="space-y-2">
          <h3 className="text-[11px] font-black uppercase text-primary tracking-widest flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-primary" />
            Tipo de Detecção
          </h3>
          <div className="space-y-2.5">
            {uniqueTypes && uniqueTypes.length > 0 ? (
              uniqueTypes.map(type => (
                <div key={type} className="flex items-center space-x-3 group text-sm cursor-pointer" onClick={() => toggleType(type)}>
                  <Checkbox 
                    id={type} 
                    checked={filterType.includes(type)}
                    onCheckedChange={() => toggleType(type)}
                    className="rounded bg-background data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                  />
                  <label
                    htmlFor={type}
                    className="font-medium text-foreground cursor-pointer group-hover:text-primary transition-colors flex-1 capitalize truncate"
                  >
                    {type}
                  </label>
                </div>
              ))
            ) : (
              DETECTIONS.map(type => (
                <div key={type.id} className="flex items-center space-x-3 group text-sm cursor-pointer" onClick={() => toggleType(type.id)}>
                  <Checkbox 
                    id={type.id} 
                    checked={filterType.includes(type.id)}
                    onCheckedChange={() => toggleType(type.id)}
                    className="rounded bg-background data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                  />
                  <label
                    htmlFor={type.id}
                    className="font-medium text-foreground cursor-pointer group-hover:text-primary transition-colors flex-1"
                  >
                    {type.label}
                  </label>
                </div>
              ))
            )}
          </div>
        </div>

        {/* SLA Monitor */}
        <div className="space-y-2 pt-1">
          <h3 className="text-[11px] font-black uppercase text-primary tracking-widest flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-primary" />
            Monitor SLA
          </h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between p-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                <span className="text-xs font-bold">Dentro do prazo</span>
              </div>
              <span className="text-xs font-black">{slaStats.safe}</span>
            </div>
            
            <div className="flex items-center justify-between p-2.5 rounded-xl border border-yellow-500/20 bg-yellow-500/5 text-yellow-600 dark:text-yellow-400">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                <span className="text-xs font-bold">Próximo ao venc.</span>
              </div>
              <span className="text-xs font-black">{slaStats.warning}</span>
            </div>
            
            <div className="flex items-center justify-between p-2.5 rounded-xl border border-red-500/20 bg-red-500/5 text-red-500">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-xs font-bold">Vencidos (Crítico)</span>
              </div>
              <span className="text-xs font-black">{slaStats.danger}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
