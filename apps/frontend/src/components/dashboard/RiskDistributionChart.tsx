import { Card, CardContent } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { useMemo } from 'react';

const RISK_COLORS: Record<string, string> = {
  critico: 'hsl(0, 84%, 60%)', // red
  alto: 'hsl(0, 84%, 60%)', // red
  medio: 'hsl(32, 95%, 55%)', // orange
  baixo: 'hsl(142, 70%, 45%)', // green
  indefinido: 'hsl(210, 20%, 60%)', // gray
};

const RISK_LABELS: Record<string, string> = {
  critico: 'Crítico',
  alto: 'Alto',
  medio: 'Médio',
  baixo: 'Baixo',
  indefinido: 'Sem classificação',
};

interface RiskDistributionChartProps {
  data: { name: string; value: number }[];
}

export const RiskDistributionChart = ({ data }: RiskDistributionChartProps) => {
  const totalItems = useMemo(() => data.reduce((acc, curr) => acc + curr.value, 0), [data]);

  return (
    <Card className="rounded-2xl shadow-sm border-border/60 bg-card overflow-hidden h-full flex flex-col">
      <div className="p-5 border-b border-border/60">
        <h3 className="font-bold text-foreground tracking-tight">Distribuição por Risco</h3>
      </div>
      <CardContent className="p-6 flex-1 flex flex-col sm:flex-row items-center justify-center gap-8 lg:gap-12">
        <div className="relative w-48 h-48 lg:w-56 lg:h-56 shrink-0">
          {data.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius="70%"
                    outerRadius="100%"
                    paddingAngle={3}
                    strokeWidth={0}
                  >
                    {data.map((entry) => (
                      <Cell key={entry.name} fill={RISK_COLORS[entry.name.toLowerCase()] || RISK_COLORS.indefinido} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ borderRadius: '12px', border: '1px solid hsl(var(--border))', fontSize: '12px', fontWeight: 600, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                <span className="text-3xl font-black text-foreground">{totalItems}</span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground w-20 leading-tight mt-1">
                  itens analisados
                </span>
              </div>
            </>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center border-4 border-dashed border-border/50 rounded-full">
              <span className="text-sm font-medium text-muted-foreground">Sem dados</span>
            </div>
          )}
        </div>

        {data.length > 0 && (
          <div className="flex flex-col gap-3 min-w-[140px]">
            {data.map((entry) => (
              <div key={entry.name} className="flex items-center justify-between text-sm group">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: RISK_COLORS[entry.name.toLowerCase()] || RISK_COLORS.indefinido }} />
                  <span className="font-semibold text-muted-foreground group-hover:text-foreground transition-colors">
                    {RISK_LABELS[entry.name.toLowerCase()] || entry.name}
                  </span>
                </div>
                <span className="font-black text-foreground ml-4">{entry.value}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
