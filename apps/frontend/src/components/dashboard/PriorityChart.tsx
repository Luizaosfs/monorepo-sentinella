import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const PRIORITY_COLORS: Record<string, string> = {
  urgente: 'hsl(0, 72%, 51%)',
  alta: 'hsl(25, 95%, 53%)',
  media: 'hsl(38, 92%, 50%)',
  baixa: 'hsl(152, 69%, 40%)',
  indefinida: 'hsl(210, 10%, 50%)',
  p1: 'hsl(0, 72%, 45%)',
  p2: 'hsl(25, 85%, 55%)',
  p3: 'hsl(45, 90%, 50%)',
  p4: 'hsl(152, 69%, 40%)',
};

interface PriorityChartProps {
  data: { name: string; value: number }[];
}

export const PriorityChart = ({ data }: PriorityChartProps) => (
  <Card className="card-modern lg:col-span-2 rounded-xl animate-fade-in">
    <CardHeader className="p-4 lg:p-6">
      <CardTitle className="text-sm lg:text-base">Itens por Prioridade</CardTitle>
    </CardHeader>
    <CardContent className="p-2 lg:p-6 lg:pt-0">
      <div className="h-52 lg:h-72">
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} barCategoryGap="25%">
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
              <XAxis dataKey="name" className="text-[10px] lg:text-xs" axisLine={false} tickLine={false} />
              <YAxis className="text-[10px] lg:text-xs" axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: '13px' }} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {data.map((entry) => (
                  <Cell key={entry.name} fill={PRIORITY_COLORS[entry.name.toLowerCase()] || 'hsl(162, 63%, 41%)'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Sem dados</div>
        )}
      </div>
    </CardContent>
  </Card>
);
