import { Activity, ClipboardList, Wrench, Radio, Bell, ArrowRight, MapPin, Clock, AlertTriangle, Scan, RotateCcw, Tag, ShieldCheck, PlayCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';
import { useFocoRiscoTimeline } from '@/hooks/queries/useFocosRisco';
import type { FocoRiscoTimelineTipo } from '@/types/database';

const ICONE_TIPO: Record<FocoRiscoTimelineTipo, React.ElementType> = {
  estado:                  ArrowRight,
  deteccao:                Scan,
  classificacao_alterada:  Tag,
  vistoria:                ClipboardList,
  vistoria_campo:          MapPin,
  acao:                    Wrench,
  sla:                     Clock,
  caso_notificado:         AlertTriangle,
  reinspecao:              RotateCcw,
  dados_minimos_completos: ShieldCheck,
  inspecao_iniciada:       PlayCircle,
};

const COR_TIPO: Record<FocoRiscoTimelineTipo, string> = {
  estado:                  '#3b82f6', // azul
  deteccao:                '#eab308', // amarelo
  classificacao_alterada:  '#0ea5e9', // sky
  vistoria:                '#22c55e', // verde
  vistoria_campo:          '#4ade80', // verde-claro
  acao:                    '#f97316', // laranja
  sla:                     '#ef4444', // vermelho
  caso_notificado:         '#dc2626', // vermelho-escuro
  reinspecao:              '#8b5cf6', // violeta
  dados_minimos_completos: '#10b981', // esmeralda
  inspecao_iniciada:       '#2563EB', // azul
};

interface Props {
  focoId: string;
}

export function FocoRiscoTimeline({ focoId }: Props) {
  const { data: items = [], isLoading } = useFocoRiscoTimeline(focoId);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="w-8 h-8 rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground py-4 text-center">Nenhum evento registrado.</p>;
  }

  return (
    <div className="relative border-l-2 border-border/50 ml-4 space-y-6">
      {items.map((item, idx) => {
        const Icon = ICONE_TIPO[item.tipo] ?? Activity;
        const dotColor = COR_TIPO[item.tipo] ?? '#6b7280';
        let dataHora: string | null = null;
        if (item.ts) {
          try {
            dataHora = format(new Date(item.ts), "dd/MM/yyyy HH:mm", { locale: ptBR });
          } catch {
            dataHora = null;
          }
        }

        return (
          <div key={idx} className="relative pl-6">
            <span
              className="absolute -left-[17px] top-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-background"
              style={{ backgroundColor: dotColor }}
            >
              <Icon className="w-3.5 h-3.5 text-white" />
            </span>
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-foreground">{item.titulo}</span>
                {dataHora && <span className="text-xs text-muted-foreground shrink-0">{dataHora}</span>}
              </div>
              {item.descricao && <p className="text-xs text-muted-foreground">{item.descricao}</p>}
              {item.tipo === 'deteccao' && item.ref_id && (
                <a
                  href={`/levantamentos?item=${item.ref_id}`}
                  className="text-[11px] text-primary underline underline-offset-2"
                >
                  Ver item do levantamento →
                </a>
              )}
              {item.ator_id && <p className="text-[11px] text-muted-foreground/70">Por: {item.ator_id}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
