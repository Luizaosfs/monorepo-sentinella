import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, MapPin, CheckCircle, ShieldAlert } from "lucide-react";

interface Props {
  total: number;
  alto: number;
  medio: number;
  baixo: number;
}

export function MapKpiRow({ total, alto, medio, baixo }: Props) {
  const kpis = [
    { label: "Total de itens", value: total, icon: MapPin, color: "text-primary", bg: "bg-primary/10" },
    { label: "Alto risco", value: alto, icon: ShieldAlert, color: "text-red-500", bg: "bg-red-500/10" },
    { label: "Médio risco", value: medio, icon: AlertTriangle, color: "text-orange-500", bg: "bg-orange-500/10" },
    { label: "Baixo risco", value: baixo, icon: CheckCircle, color: "text-emerald-500", bg: "bg-emerald-500/10" },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 mb-6">
      {kpis.map((kpi, idx) => (
        <Card key={idx} className="rounded-xl shadow-none border-border/60 bg-card overflow-hidden">
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mr-1">
                {kpi.label}
              </span>
              <div className={`w-6 h-6 rounded-lg ${kpi.bg} flex items-center justify-center shrink-0`}>
                <kpi.icon className={`w-3.5 h-3.5 ${kpi.color}`} />
              </div>
            </div>
            <div className="text-xl font-black text-foreground">{kpi.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
