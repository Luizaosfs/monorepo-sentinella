import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { Loader2, MapPin, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAtualizarGeometriaQuarteirao } from '@/hooks/queries/useGestaoQuadras';
import type { RegiaoParaDesenho } from '@/components/quarteiroes/ModalDesenharQuarteirao';
import type { QuarteiraoParaEdicao } from './types';

const DrawPolygonMap = lazy(() => import('@/components/map/DrawPolygonMap'));

type GeoJSONPolygon = { type: 'Polygon'; coordinates: number[][][] };

interface Props {
  open: boolean;
  quarteirao: QuarteiraoParaEdicao | null;
  regioes: RegiaoParaDesenho[];
  onClose: () => void;
}

function nomeRegiao(r: RegiaoParaDesenho): string {
  return r.nome ?? r.regiao ?? r.id;
}

export function ModalEditarGeometriaQuarteirao({ open, quarteirao, regioes, onClose }: Props) {
  const atualizarGeom = useAtualizarGeometriaQuarteirao();

  // Collect the drawn polygon via ref — avoids feeding onChange back to value,
  // which would reset the Leaflet Draw edit session on every user interaction.
  const geojsonDraftRef = useRef<GeoJSONPolygon | null>(null);

  // Bump key to remount DrawPolygonMap when a different quarteirao is opened.
  const [mapKey, setMapKey] = useState(0);

  const regiao = regioes.find((r) => r.id === quarteirao?.regiaoId) ?? null;

  useEffect(() => {
    if (open && quarteirao) {
      geojsonDraftRef.current = (quarteirao.geojson ?? null) as GeoJSONPolygon | null;
      setMapKey((k) => k + 1);
    }
  }, [open, quarteirao?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSalvar() {
    if (!quarteirao) return;
    atualizarGeom.mutate(
      { id: quarteirao.id, geojson: geojsonDraftRef.current as Record<string, unknown> | null },
      {
        onSuccess: () => {
          toast.success(`Geometria de ${quarteirao.codigo} atualizada`);
          onClose();
        },
        onError: (err: unknown) => {
          const msg = (err as { message?: string })?.message ?? 'Erro ao salvar geometria';
          toast.error(msg);
        },
      },
    );
  }

  function handleRemover() {
    if (!quarteirao?.geojson) return;
    atualizarGeom.mutate(
      { id: quarteirao.id, geojson: null },
      {
        onSuccess: () => {
          toast.success(`Geometria de ${quarteirao.codigo} removida`);
          onClose();
        },
        onError: (err: unknown) => {
          const msg = (err as { message?: string })?.message ?? 'Erro ao remover geometria';
          toast.error(msg);
        },
      },
    );
  }

  const temGeom = !!quarteirao?.geojson;
  const titulo = temGeom ? `Editar geometria — ${quarteirao?.codigo}` : `Desenhar geometria — ${quarteirao?.codigo}`;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            {titulo}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-1">
          {regiao?.geojson ? (
            <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
              <MapPin className="h-3.5 w-3.5 text-green-600 shrink-0 mt-0.5" />
              <span>
                Limite de <strong>{nomeRegiao(regiao)}</strong> exibido em verde tracejado. Mantenha o
                quarteirão <strong>dentro</strong> deste limite — o backend valida com PostGIS.
              </span>
            </div>
          ) : quarteirao?.regiaoId ? (
            <div className="text-xs text-amber-700 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
              Esta região não tem geometria cadastrada. O backend validará apenas a validade do polígono.
            </div>
          ) : null}

          <Suspense
            fallback={
              <div className="h-[380px] rounded-lg border bg-muted/30 flex items-center justify-center text-xs text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando mapa…
              </div>
            }
          >
            <DrawPolygonMap
              key={mapKey}
              value={(quarteirao?.geojson ?? null) as GeoJSONPolygon | null}
              onChange={(g) => { geojsonDraftRef.current = g; }}
              backgroundGeoJSON={regiao?.geojson ?? null}
              mapClassName="h-[380px]"
            />
          </Suspense>

          {!temGeom && (
            <p className="text-xs text-muted-foreground">
              Use a ferramenta de polígono no canto superior direito do mapa para desenhar a área do quarteirão.
            </p>
          )}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button variant="outline" onClick={onClose} className="sm:mr-auto">
            Cancelar
          </Button>
          {temGeom && (
            <Button
              variant="outline"
              className="text-destructive border-destructive/30 hover:bg-destructive/10"
              onClick={handleRemover}
              disabled={atualizarGeom.isPending}
            >
              <Trash2 className="h-4 w-4 mr-1.5" />
              Remover geometria
            </Button>
          )}
          <Button onClick={handleSalvar} disabled={atualizarGeom.isPending}>
            {atualizarGeom.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Salvar geometria
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
