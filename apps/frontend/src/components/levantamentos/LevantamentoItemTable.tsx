import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Eye, Image as ImageIcon, Circle, CircleDot, CheckCircle2, Camera } from 'lucide-react';
import { LevantamentoItem, StatusAtendimento } from '@/types/database';
import { resolveMediaUrl } from '@/lib/media';
import { StatusBadge } from './StatusBadge';
import { cn } from '@/lib/utils';

const ATEND_ICON: Record<StatusAtendimento, React.ReactNode> = {
  pendente:        <Circle className="w-3.5 h-3.5 text-muted-foreground" />,
  em_atendimento:  <CircleDot className="w-3.5 h-3.5 text-blue-500" />,
  resolvido:       <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />,
};
const ATEND_LABEL: Record<StatusAtendimento, string> = {
  pendente: 'Pendente',
  em_atendimento: 'Em atend.',
  resolvido: 'Resolvido',
};

interface TableProps {
  items: LevantamentoItem[];
  onSelectItem: (item: LevantamentoItem) => void;
}

export const LevantamentoItemTable = ({ items, onSelectItem }: TableProps) => {
  return (
    <div className="hidden sm:block rounded-xl border-2 border-cardBorder overflow-hidden shadow-sm">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50 border-border">
            <TableHead className="font-semibold text-xs w-[60px]">Foto</TableHead>
            <TableHead className="font-semibold text-xs">Item</TableHead>
            <TableHead className="font-semibold text-xs">Risco</TableHead>
            <TableHead className="font-semibold text-xs">Prioridade</TableHead>
            <TableHead className="font-semibold text-xs">Status</TableHead>
            <TableHead className="font-semibold text-xs">Score</TableHead>
            <TableHead className="font-semibold text-xs">SLA</TableHead>
            <TableHead className="font-semibold text-xs">Endereço</TableHead>
            <TableHead className="font-semibold text-xs w-[80px]">Detalhes</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow
              key={item.id}
              className={cn(
                'cursor-pointer hover:bg-muted/30',
                item.status_atendimento === 'resolvido' && 'opacity-60'
              )}
              onClick={() => onSelectItem(item)}
            >
              <TableCell className="p-2">
                <div className="relative">
                  {resolveMediaUrl(item.image_url) ? (
                    <div className="w-10 h-10 rounded-md overflow-hidden border border-border bg-muted">
                      <img src={resolveMediaUrl(item.image_url)!} alt="" className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-md border border-border bg-muted/50 flex items-center justify-center">
                      <ImageIcon className="w-4 h-4 text-muted-foreground/40" />
                    </div>
                  )}
                  {item.acao_aplicada && (
                    <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 border border-background">
                      <Camera className="w-2.5 h-2.5 text-white" />
                    </span>
                  )}
                </div>
              </TableCell>
              <TableCell className="font-medium text-sm max-w-[180px]">
                <span className="line-clamp-2">{item.item || '—'}</span>
                {item.codigo_foco && (
                  <span className="block text-[10px] font-mono text-muted-foreground/70 mt-0.5">{item.codigo_foco}</span>
                )}
              </TableCell>
              <TableCell><StatusBadge type="risco" value={item.risco} /></TableCell>
              <TableCell><StatusBadge type="prioridade" value={item.prioridade} /></TableCell>
              <TableCell>
                {(() => {
                  const s = (item.status_atendimento ?? 'pendente') as StatusAtendimento;
                  return (
                    <span className={cn('flex items-center gap-1 text-xs font-medium whitespace-nowrap',
                      s === 'resolvido' ? 'text-emerald-600' : s === 'em_atendimento' ? 'text-blue-600' : 'text-muted-foreground'
                    )}>
                      {ATEND_ICON[s]}{ATEND_LABEL[s]}
                    </span>
                  );
                })()}
              </TableCell>
              <TableCell><span className="font-mono text-sm font-semibold">{item.score_final ?? '—'}</span></TableCell>
              <TableCell><span className="text-xs font-mono">{item.sla_horas ? `${item.sla_horas}h` : '—'}</span></TableCell>
              <TableCell className="text-xs max-w-[160px]"><span className="line-clamp-2 text-muted-foreground">{item.endereco_curto || '—'}</span></TableCell>
              <TableCell>
                <Button variant="ghost" size="sm" className="text-xs gap-1.5 text-primary hover:bg-primary/10" onClick={(e) => { e.stopPropagation(); onSelectItem(item); }}>
                  <Eye className="w-3.5 h-3.5" /> Ver
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

