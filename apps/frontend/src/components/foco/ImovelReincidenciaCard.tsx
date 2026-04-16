import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { RotateCcw, AlertTriangle, MapPin, Beaker } from 'lucide-react';
import {
  PADRAO_COR, PADRAO_LABEL, DEPOSITO_LABELS,
  type ImovelReincidente,
} from '@/hooks/queries/useReincidenciaInteligente';

interface ImovelReincidenciaCardProps {
  imovel: ImovelReincidente;
  compact?: boolean;
  onClick?: () => void;
}

export function ImovelReincidenciaCard({ imovel, compact = false, onClick }: ImovelReincidenciaCardProps) {
  const diasLabel = imovel.dias_desde_ultimo_foco < 30
    ? `${imovel.dias_desde_ultimo_foco} dias atrás`
    : imovel.dias_desde_ultimo_foco < 365
      ? `${Math.round(imovel.dias_desde_ultimo_foco / 30)} meses atrás`
      : `${Math.round(imovel.dias_desde_ultimo_foco / 365)} ano(s) atrás`;

  if (compact) {
    return (
      <div
        className={cn(
          'flex items-center justify-between p-3 rounded-xl border bg-card',
          'hover:bg-muted/30 transition-colors',
          onClick && 'cursor-pointer',
          imovel.padrao === 'cronico' && 'border-l-4 border-l-red-500',
          imovel.padrao === 'recorrente' && 'border-l-4 border-l-orange-500',
        )}
        onClick={onClick}
      >
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">
            {imovel.logradouro ?? 'Endereço não identificado'}
            {imovel.numero ? `, ${imovel.numero}` : ''}
          </p>
          <p className="text-xs text-muted-foreground">
            {imovel.bairro ?? '—'} · {imovel.total_focos_historico} foco(s) histórico(s) · último {diasLabel}
          </p>
        </div>
        <div className="flex items-center gap-2 ml-3 shrink-0">
          <Badge className={cn('text-[10px] border', PADRAO_COR[imovel.padrao])}>
            {PADRAO_LABEL[imovel.padrao]}
          </Badge>
          {imovel.focos_ativos > 0 && (
            <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" title="Foco ativo" />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 rounded-2xl border bg-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold">
            {imovel.logradouro ?? 'Endereço não identificado'}
            {imovel.numero ? `, ${imovel.numero}` : ''}
          </p>
          <p className="text-sm text-muted-foreground">
            {imovel.bairro ?? '—'}
            {imovel.quarteirao ? ` · Qd. ${imovel.quarteirao}` : ''}
          </p>
        </div>
        <Badge className={cn('border text-xs shrink-0', PADRAO_COR[imovel.padrao])}>
          {PADRAO_LABEL[imovel.padrao]}
        </Badge>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Focos históricos', valor: imovel.total_focos_historico, icon: RotateCcw },
          { label: 'Reincidências', valor: imovel.focos_reincidentes, icon: AlertTriangle },
          { label: 'Ciclos afetados', valor: imovel.ciclos_com_foco, icon: MapPin },
          {
            label: 'Intervalo médio',
            valor: imovel.intervalo_medio_dias ? `${imovel.intervalo_medio_dias}d` : 'N/D',
            icon: RotateCcw,
          },
        ].map(({ label, valor, icon: Icon }) => (
          <div key={label} className="text-center p-2 rounded-xl bg-muted/30">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-lg font-black">{valor}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        {imovel.deposito_predominante && (
          <span className="px-2 py-1 rounded-md bg-muted border text-muted-foreground">
            <Beaker className="inline h-3 w-3 mr-1" />
            {DEPOSITO_LABELS[imovel.deposito_predominante] ?? imovel.deposito_predominante}
          </span>
        )}
        {imovel.historico_recusa && (
          <span className="px-2 py-1 rounded-md bg-red-50 border border-red-200 text-red-700">
            Histórico de recusa
          </span>
        )}
        {imovel.tentativas_sem_acesso > 0 && (
          <span className="px-2 py-1 rounded-md bg-amber-50 border border-amber-200 text-amber-700">
            {imovel.tentativas_sem_acesso}× sem acesso
          </span>
        )}
        {!imovel.usou_larvicida_alguma_vez && imovel.total_focos_historico > 1 && (
          <span className="px-2 py-1 rounded-md bg-orange-50 border border-orange-200 text-orange-700">
            Sem larvicida
          </span>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Último foco: {diasLabel}
        {imovel.focos_ativos > 0 && (
          <span className="ml-2 text-red-600 font-semibold">
            · {imovel.focos_ativos} foco(s) ativo(s)
          </span>
        )}
      </p>
    </div>
  );
}
