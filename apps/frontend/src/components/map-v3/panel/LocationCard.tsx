import { LevantamentoItem } from '@/types/database';
import { Button } from '@/components/ui/button';
import { MapPin, ExternalLink, Navigation } from 'lucide-react';

interface LocationCardProps {
  item: LevantamentoItem;
  className?: string;
}

export function LocationCard({ item, className = '' }: LocationCardProps) {
  const address = item.endereco_curto || item.endereco_completo || null;
  const fullAddress = item.endereco_completo ?? null;
  const hasCoords =
    item.latitude != null && item.longitude != null;
  const coords =
    hasCoords
      ? `${item.latitude.toFixed(5)}, ${item.longitude.toFixed(5)}`
      : null;

  return (
    <div
      className={`rounded-xl border border-border/60 bg-card p-4 space-y-3 shadow-sm animate-in fade-in duration-200 ${className}`}
    >
      <div className="flex items-start gap-2">
        <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className="text-xs font-medium text-foreground">
            {address || 'Endereço não informado'}
          </p>
          {fullAddress && fullAddress !== address && (
            <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
              {fullAddress}
            </p>
          )}
        </div>
      </div>
      {coords && (
        <p className="text-[11px] font-mono text-muted-foreground pl-6">
          {coords}
        </p>
      )}
      <div className="flex gap-2 pt-1">
        {item.maps ? (
          <Button
            variant="outline"
            size="sm"
            className="flex-1 rounded-lg h-8 text-xs border-border/60 hover:bg-muted"
            onClick={() => window.open(item.maps!, '_blank')}
          >
            <ExternalLink className="w-3.5 h-3.5 mr-1.5 text-blue-400" />
            Google Maps
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
              className="flex-1 rounded-lg h-8 text-xs border-border/60 opacity-50"
            disabled
          >
            Maps
          </Button>
        )}
        {item.waze ? (
          <Button
            variant="outline"
            size="sm"
            className="flex-1 rounded-lg h-8 text-xs border-border/60 hover:bg-muted"
            onClick={() => window.open(item.waze!, '_blank')}
          >
            <Navigation className="w-3.5 h-3.5 mr-1.5 text-teal-400" />
            Waze
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
              className="flex-1 rounded-lg h-8 text-xs border-border/60 opacity-50"
            disabled
          >
            Waze
          </Button>
        )}
      </div>
    </div>
  );
}
