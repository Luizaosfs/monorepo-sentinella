import { Calendar, ClipboardList, ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Levantamento } from '@/types/database';

interface LevantamentoListProps {
  items: Levantamento[];
  onSelect: (lev: Levantamento) => void;
}

export const LevantamentoList = ({ items, onSelect }: LevantamentoListProps) => {
  return (
    <div className="grid gap-3">
      {items.map((lev) => (
        <Card key={lev.id} className="card-modern rounded-xl cursor-pointer group transition-all" onClick={() => onSelect(lev)}>
          <CardContent className="flex items-center justify-between py-4 px-5">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/15 transition-colors">
                <ClipboardList className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-sm group-hover:text-primary transition-colors">{lev.titulo}</p>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {new Date(lev.data_voo).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </span>
                  <Badge variant="secondary" className="text-xs font-semibold">{lev.total_itens} itens</Badge>
                  {lev.tipo_entrada && (
                    <Badge variant="outline" className="text-xs">{lev.tipo_entrada === 'DRONE' ? 'Drone' : 'Manual'}</Badge>
                  )}
                </div>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
