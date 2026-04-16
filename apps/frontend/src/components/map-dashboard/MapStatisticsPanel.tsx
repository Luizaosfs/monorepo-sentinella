import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, MapPin, Map, TrendingUp } from "lucide-react";

interface Props {
  totalPoints: number;
  criticalPoints: number;
  regionsAffected: number;
  averageScore: number;
}

export function MapStatisticsPanel({ totalPoints, criticalPoints, regionsAffected, averageScore }: Props) {
  const kpis = [
    { title: "Total Detectados", value: totalPoints, icon: MapPin, color: "text-primary", bg: "bg-primary/10" },
    { title: "Pontos Críticos", value: criticalPoints, icon: AlertTriangle, color: "text-red-500", bg: "bg-red-500/10" },
    { title: "Regiões Afetadas", value: regionsAffected, icon: Map, color: "text-orange-500", bg: "bg-orange-500/10" },
    { title: "Score Médio", value: averageScore, icon: TrendingUp, color: "text-emerald-500", bg: "bg-emerald-500/10" },
  ];

  return (
    <div className="grid grid-cols-2 gap-2 mb-2">
      {kpis.map((kpi, index) => (
        <Card key={index} className="rounded-xl shadow-none border-border/60 bg-card overflow-hidden">
          <CardContent className="p-2.5">
            <div className="flex items-center justify-between mb-2">
              <span className={`text-[10px] font-bold uppercase tracking-wider mr-1 ${kpi.color}`}>
                {kpi.title}
              </span>
              <div className={`w-6 h-6 rounded-lg ${kpi.bg} flex items-center justify-center shrink-0`}>
                <kpi.icon className={`w-3.5 h-3.5 ${kpi.color}`} />
              </div>
            </div>
            <div className="text-2xl font-black text-foreground">{kpi.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
