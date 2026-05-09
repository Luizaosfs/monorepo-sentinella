import { useState, useMemo, useEffect, lazy, Suspense } from 'react';
import { Loader2, MapPin, PenLine } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useDesenharQuarteirao } from '@/hooks/queries/useGestaoQuadras';

// Lazy-load para evitar SSR / Leaflet no bundle principal
const DrawPolygonMap = lazy(() => import('@/components/map/DrawPolygonMap'));

export interface RegiaoParaDesenho {
  id: string;
  nome?: string;
  regiao?: string;
  geojson?: Record<string, unknown> | null;
  latitude?: number | null;
  longitude?: number | null;
}

interface Props {
  open: boolean;
  regioes: RegiaoParaDesenho[];
  /** Pré-seleciona uma região ao abrir (ex: clicado na linha da região) */
  regiaoIdInicial?: string | null;
  onClose: () => void;
  /** Chamado após salvar com sucesso — usar para invalidar queries no parent */
  onSalvo?: () => void;
}

function nomeRegiao(r: RegiaoParaDesenho): string {
  return r.nome ?? r.regiao ?? r.id;
}

export function ModalDesenharQuarteirao({
  open, regioes, regiaoIdInicial, onClose, onSalvo,
}: Props) {
  const desenhar = useDesenharQuarteirao();

  const [regiaoId, setRegiaoId] = useState(regiaoIdInicial ?? '');
  const [codigo, setCodigo] = useState('');
  const [geojson, setGeojson] = useState<Record<string, unknown> | null>(null);

  const regiao = useMemo(
    () => regioes.find((r) => r.id === regiaoId) ?? null,
    [regioes, regiaoId],
  );

  // When region has geojson, DrawPolygonMap.fitBounds() handles the view automatically.
  // mapCenter is only used as fallback when there is no background polygon.
  const mapCenter = useMemo<[number, number]>(() => {
    if (regiao?.geojson) return [-15.78, -47.93]; // irrelevant — backgroundGeoJSON takes over
    if (regiao?.latitude && regiao?.longitude) {
      return [regiao.latitude as number, regiao.longitude as number];
    }
    return [-15.78, -47.93];
  }, [regiao]);

  // Sincroniza região e reseta form sempre que o modal abre
  useEffect(() => {
    if (open) {
      setRegiaoId(regiaoIdInicial ?? '');
      setCodigo('');
      setGeojson(null);
      // Auto-focus no código quando região já vem pré-selecionada
      if (regiaoIdInicial) {
        setTimeout(() => {
          document.getElementById('desenho-codigo')?.focus();
        }, 80);
      }
    }
  }, [open, regiaoIdInicial]);

  function handleClose() {
    setCodigo('');
    setGeojson(null);
    onClose();
  }

  function handleSalvar() {
    if (!regiaoId) { toast.error('Selecione uma região'); return; }
    const c = codigo.trim().toUpperCase();
    if (!c) { toast.error('Informe o código do quarteirão'); return; }
    if (!geojson) { toast.error('Desenhe o polígono no mapa antes de salvar'); return; }

    desenhar.mutate(
      { regiaoId, codigo: c, geojson },
      {
        onSuccess: () => {
          toast.success(`Quarteirão ${c} criado com polígono`);
          onSalvo?.();
          handleClose();
        },
        onError: (err: unknown) => {
          const msg = (err as { message?: string })?.message ?? 'Erro ao criar quarteirão';
          toast.error(msg);
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PenLine className="h-4 w-4" />
            Desenhar quarteirão no mapa
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Região + Código */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Região / Bairro *</Label>
              <Select value={regiaoId} onValueChange={setRegiaoId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma região" />
                </SelectTrigger>
                <SelectContent>
                  {regioes.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{nomeRegiao(r)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="desenho-codigo">Código do quarteirão *</Label>
              <Input
                id="desenho-codigo"
                placeholder="Ex: A1, B-02"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && handleSalvar()}
              />
            </div>
          </div>

          {/* Dica sobre limite da região */}
          {regiao?.geojson && (
            <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
              <MapPin className="h-3.5 w-3.5 text-green-600 shrink-0 mt-0.5" />
              <span>
                Limite de <strong>{nomeRegiao(regiao)}</strong> exibido em verde tracejado. Desenhe o quarteirão
                <strong> dentro</strong> deste limite — o backend valida com PostGIS.
              </span>
            </div>
          )}
          {regiaoId && !regiao?.geojson && (
            <div className="text-xs text-amber-700 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
              Esta região não tem geometria cadastrada. O backend validará a validade do polígono, mas não o limite territorial.
            </div>
          )}

          {/* Mapa Leaflet Draw */}
          <Suspense
            fallback={
              <div className="h-[380px] rounded-lg border bg-muted/30 flex items-center justify-center text-xs text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando mapa…
              </div>
            }
          >
            <DrawPolygonMap
              value={geojson as { type: 'Polygon'; coordinates: number[][][] } | null}
              onChange={(g) => setGeojson(g as Record<string, unknown> | null)}
              center={mapCenter}
              backgroundGeoJSON={regiao?.geojson ?? null}
              mapClassName="h-[380px]"
            />
          </Suspense>

          {geojson && (
            <p className="text-xs text-emerald-600">
              Polígono desenhado. O backend validará: validade geométrica, containment na região e sobreposição com outros quarteirões.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancelar</Button>
          <Button
            onClick={handleSalvar}
            disabled={desenhar.isPending || !regiaoId || !codigo.trim() || !geojson}
          >
            {desenhar.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Salvar quarteirão
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
