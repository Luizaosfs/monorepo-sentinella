import { useState } from 'react';
import { Loader2, MapPin, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useSalvarQuadra } from '@/hooks/queries/useGestaoQuadras';
import type { Quarteirao } from '@/types/database';
import DrawPolygonMap from '@/components/map/DrawPolygonMap';

type GeoJSONPolygon = { type: 'Polygon'; coordinates: number[][][] };

interface Props {
  quarteirao: Quarteirao;
  onClose: () => void;
}

export function QuarteiraoMapEditor({ quarteirao, onClose }: Props) {
  const salvar = useSalvarQuadra();

  const initialGeojson =
    quarteirao.geojson != null &&
    (quarteirao.geojson as Record<string, unknown>).type === 'Polygon'
      ? (quarteirao.geojson as unknown as GeoJSONPolygon)
      : null;

  const [geojson, setGeojson] = useState<GeoJSONPolygon | null>(initialGeojson);
  const [dirty, setDirty] = useState(false);

  const center: [number, number] =
    quarteirao.latitude != null && quarteirao.longitude != null
      ? [quarteirao.latitude, quarteirao.longitude]
      : [-15.78, -47.93];

  function handleChange(g: GeoJSONPolygon | null) {
    setGeojson(g);
    setDirty(true);
  }

  function handleSave() {
    salvar.mutate(
      { id: quarteirao.id, geojson: geojson as Record<string, unknown> | null },
      {
        onSuccess: () => {
          toast.success(geojson ? 'Polígono salvo' : 'Área removida');
          onClose();
        },
      },
    );
  }

  function handleRemover() {
    if (!confirm('Remover o polígono desta quadra?')) return;
    salvar.mutate(
      { id: quarteirao.id, geojson: null },
      { onSuccess: () => { toast.success('Área removida'); onClose(); } },
    );
  }

  return (
    <Sheet open onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-2xl flex flex-col p-0 gap-0">
        <SheetHeader className="px-6 pt-6 pb-4 border-b flex-shrink-0">
          <SheetTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary" />
            Área — {quarteirao.codigo}
          </SheetTitle>
          <p className="text-sm text-muted-foreground">
            Desenhe ou edite o polígono. Apenas Polygon simples é aceito.
          </p>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <DrawPolygonMap
            value={geojson}
            onChange={handleChange}
            center={center}
            mapClassName="h-[500px]"
            hideLegend
          />
          <p className="text-xs text-muted-foreground mt-2">
            Use a ferramenta de polígono (canto superior direito do mapa) para
            desenhar. MultiPolygon não é suportado.
          </p>
        </div>

        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t flex-shrink-0">
          <Button
            variant="outline"
            size="sm"
            className="text-destructive border-destructive/40 hover:bg-destructive/10"
            disabled={!quarteirao.geojson || salvar.isPending}
            onClick={handleRemover}
          >
            <Trash2 className="w-3.5 h-3.5 mr-1.5" />
            Remover área
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              size="sm"
              disabled={!dirty || salvar.isPending}
              onClick={handleSave}
            >
              {salvar.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Salvar polígono
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
