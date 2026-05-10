import { useState, useCallback, lazy, Suspense, useMemo } from 'react';
import { Upload, FileJson, Loader2, CheckCircle2, XCircle, Trash2, Download } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useImportarGeoJSONQuarteiroes } from '@/hooks/queries/useGestaoQuadras';

const PreviewPolygonsMap = lazy(() => import('./PreviewPolygonsMap'));

interface RegiaoInfo {
  id: string;
  nome: string;
  geojson?: Record<string, unknown> | null;
}

interface PolygonFeature {
  tempId: number;
  codigo: string;
  geojson: { type: 'Polygon'; coordinates: number[][][] };
  bairroId?: string;
  bairro?: string;
  regiaoNomeDetectada?: string;
}

interface ImportResult {
  ok: number;
  erros: Array<{ codigo: string; motivo: string }>;
  criados?: string[];
}

interface Props {
  open: boolean;
  regioes: RegiaoInfo[];
  onClose: () => void;
  onSalvo?: () => void;
}

const MODELO_GEOJSON = JSON.stringify(
  {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { codigo: 'A01', bairro: 'Centro' },
        geometry: {
          type: 'Polygon',
          coordinates: [[[-47.935, -15.78], [-47.934, -15.78], [-47.934, -15.781], [-47.935, -15.781], [-47.935, -15.78]]],
        },
      },
      {
        type: 'Feature',
        properties: { codigo: 'A02', bairro: 'Centro' },
        geometry: {
          type: 'Polygon',
          coordinates: [[[-47.934, -15.78], [-47.933, -15.78], [-47.933, -15.781], [-47.934, -15.781], [-47.934, -15.78]]],
        },
      },
      {
        type: 'Feature',
        properties: { codigo: 'B01', bairro: 'Setor Norte' },
        geometry: {
          type: 'Polygon',
          coordinates: [[[-47.935, -15.781], [-47.934, -15.781], [-47.934, -15.782], [-47.935, -15.782], [-47.935, -15.781]]],
        },
      },
      {
        type: 'Feature',
        properties: { bairro: 'Setor Norte' },
        geometry: {
          type: 'Polygon',
          coordinates: [[[-47.934, -15.781], [-47.933, -15.781], [-47.933, -15.782], [-47.934, -15.782], [-47.934, -15.781]]],
        },
      },
    ],
  },
  null,
  2,
);

function baixarModelo() {
  const blob = new Blob([MODELO_GEOJSON], { type: 'application/geo+json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'modelo-quarteiroes.geojson';
  a.click();
  URL.revokeObjectURL(url);
}

function gerarCodigo(prefixo: string, index: number, total: number): string {
  const digits = total > 99 ? 3 : total > 9 ? 2 : 1;
  return `${prefixo.trim().toUpperCase()}${String(index + 1).padStart(digits, '0')}`;
}

function parseGeoJSONFile(
  text: string,
  regioes: RegiaoInfo[],
): PolygonFeature[] | string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return 'Arquivo inválido — JSON malformado.';
  }

  const obj = parsed as Record<string, unknown>;

  // FeatureCollection
  if (obj.type === 'FeatureCollection' && Array.isArray(obj.features)) {
    const polys: PolygonFeature[] = [];
    for (const f of obj.features as unknown[]) {
      const feat = f as Record<string, unknown>;
      if (feat.type !== 'Feature') continue;
      const geom = feat.geometry as Record<string, unknown> | null;
      if (!geom || geom.type !== 'Polygon') continue;
      const props = ((feat.properties ?? {}) as Record<string, unknown>);

      const codigo = String(
        props.codigo ?? props.code ?? props.id ?? props.quarteirao ?? '',
      ).trim();
      const bairro = String(
        props.bairro ?? props.regiao ?? props.neighborhood ?? props.district ?? '',
      ).trim() || undefined;
      const bairroIdProp = String(props.bairro_id ?? props.regiaoId ?? '').trim() || undefined;

      // Local name match for display
      const regiaoNomeDetectada = bairro
        ? (regioes.find(
            (r) => r.nome.toLowerCase().trim() === bairro.toLowerCase(),
          )?.nome ?? bairro)
        : undefined;

      polys.push({
        tempId: polys.length,
        codigo,
        geojson: geom as PolygonFeature['geojson'],
        bairroId: bairroIdProp,
        bairro,
        regiaoNomeDetectada,
      });
    }
    if (polys.length === 0)
      return 'Nenhum polígono (Feature com geometry.type=Polygon) encontrado.';
    return polys;
  }

  // Single Polygon
  if (obj.type === 'Polygon' && Array.isArray(obj.coordinates)) {
    return [{ tempId: 0, codigo: '', geojson: obj as PolygonFeature['geojson'] }];
  }

  return 'Formato não suportado — envie um GeoJSON do tipo FeatureCollection ou Polygon.';
}

export function ModalImportarGeoJSONQuarteiroes({
  open, regioes, onClose, onSalvo,
}: Props) {
  const importar = useImportarGeoJSONQuarteiroes();

  const [features, setFeatures] = useState<PolygonFeature[]>([]);
  const [prefixo, setPrefixo] = useState('Q');
  const [highlightId, setHighlightId] = useState<number | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [dragging, setDragging] = useState(false);

  const highlightCodigo = highlightId != null
    ? (features.find((f) => f.tempId === highlightId)?.codigo ?? null)
    : null;

  // All region boundaries merged into a single FeatureCollection for the map background
  const backgroundGeoJSON = useMemo(() => {
    const fs = regioes
      .filter((r) => r.geojson)
      .map((r) => ({
        type: 'Feature' as const,
        properties: { nome: r.nome },
        geometry: r.geojson,
      }));
    if (fs.length === 0) return null;
    return { type: 'FeatureCollection', features: fs } as Record<string, unknown>;
  }, [regioes]);

  const handleReset = () => {
    setFeatures([]);
    setResult(null);
    setHighlightId(null);
  };

  const handleClose = () => {
    handleReset();
    setPrefixo('Q');
    onClose();
  };

  const loadFile = useCallback(
    (text: string) => {
      setResult(null);
      const parsed = parseGeoJSONFile(text, regioes);
      if (typeof parsed === 'string') {
        toast.error(parsed);
        return;
      }
      // Auto-assign codes from properties or generate from prefix
      const withCodes = parsed.map((f, i) => ({
        ...f,
        codigo: f.codigo || gerarCodigo(prefixo, i, parsed.length),
      }));
      setFeatures(withCodes);
    },
    [prefixo, regioes],
  );

  const handleFileInput = (file: File) => {
    if (!file.name.match(/\.(geojson|json)$/i)) {
      toast.error('Apenas arquivos .geojson ou .json são aceitos.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => loadFile(e.target?.result as string);
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileInput(file);
  };

  const handleRegenCodes = () => {
    setFeatures((prev) =>
      prev.map((f, i) => ({ ...f, codigo: gerarCodigo(prefixo, i, prev.length) })),
    );
  };

  const handleCodeChange = (tempId: number, value: string) => {
    setFeatures((prev) =>
      prev.map((f) =>
        f.tempId === tempId ? { ...f, codigo: value.toUpperCase() } : f,
      ),
    );
  };

  const handleRemove = (tempId: number) => {
    setFeatures((prev) => prev.filter((f) => f.tempId !== tempId));
  };

  const handleImportar = () => {
    const codigos = features.map((f) => f.codigo.trim().toUpperCase()).filter(Boolean);
    const duplicados = codigos.filter((c, i, arr) => arr.indexOf(c) !== i);
    if (duplicados.length > 0) {
      toast.error(`Códigos duplicados: ${duplicados.join(', ')}`);
      return;
    }
    if (features.some((f) => !f.codigo.trim())) {
      toast.error('Há quarteirões sem código. Preencha ou gere os códigos.');
      return;
    }

    importar.mutate(
      {
        features: features.map((f) => ({
          codigo: f.codigo.trim().toUpperCase(),
          geojson: f.geojson as unknown as Record<string, unknown>,
          bairroId: f.bairroId || undefined,
          bairro: f.bairro || undefined,
        })),
      },
      {
        onSuccess: (data) => {
          setResult(data);
          if (data.ok > 0) {
            toast.success(`${data.ok} quarteirão(ões) importado(s) com sucesso.`);
            onSalvo?.();
          }
          if (data.erros.length > 0) {
            toast.warning(`${data.erros.length} falharam — veja os detalhes.`);
          }
        },
        onError: (err: unknown) => {
          toast.error(
            (err as { message?: string })?.message ?? 'Erro ao importar quarteirões',
          );
        },
      },
    );
  };

  const hasFeatures = features.length > 0;
  const comRegiao = features.filter((f) => f.bairro || f.bairroId).length;
  const semRegiao = features.length - comRegiao;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileJson className="h-4 w-4" />
            Importar quarteirões via GeoJSON
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            O sistema detecta automaticamente o bairro de cada polígono via PostGIS.
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-1 pr-1">
          {/* Drop zone */}
          {!hasFeatures && (
            <div
              className={cn(
                'border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer',
                dragging
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50',
              )}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => document.getElementById('geojson-file-input-global')?.click()}
            >
              <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm font-medium">
                Arraste o arquivo .geojson da prefeitura ou clique para selecionar
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                FeatureCollection com todos os quarteirões de todos os bairros. Máx. 500 polígonos.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-4 gap-1.5 text-xs"
                onClick={(e) => { e.stopPropagation(); baixarModelo(); }}
              >
                <Download className="h-3.5 w-3.5" />
                Baixar modelo .geojson
              </Button>
              <input
                id="geojson-file-input-global"
                type="file"
                accept=".geojson,.json,application/geo+json,application/json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFileInput(f);
                }}
              />
            </div>
          )}

          {/* After file loaded */}
          {hasFeatures && (
            <>
              {/* Summary + prefix */}
              <div className="flex items-end gap-3 flex-wrap">
                <div className="space-y-1">
                  <Label className="text-xs">Prefixo dos códigos</Label>
                  <Input
                    value={prefixo}
                    onChange={(e) => setPrefixo(e.target.value.toUpperCase())}
                    className="h-7 w-20 text-xs font-mono"
                    maxLength={6}
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRegenCodes}
                  className="h-7 text-xs"
                >
                  Gerar códigos
                </Button>
                <div className="flex gap-1.5 flex-wrap ml-auto">
                  <Badge variant="outline" className="text-[10px]">
                    {features.length} polígonos
                  </Badge>
                  {comRegiao > 0 && (
                    <Badge className="text-[10px] bg-emerald-100 text-emerald-800 border-transparent">
                      {comRegiao} com bairro detectado
                    </Badge>
                  )}
                  {semRegiao > 0 && (
                    <Badge className="text-[10px] bg-amber-100 text-amber-800 border-transparent">
                      {semRegiao} sem bairro — PostGIS detectará
                    </Badge>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleReset}
                  className="h-7 text-xs text-muted-foreground gap-1"
                >
                  <Trash2 className="h-3 w-3" />
                  Limpar
                </Button>
              </div>

              {/* Map preview */}
              <Suspense
                fallback={
                  <div className="h-[240px] rounded-lg border bg-muted/30 flex items-center justify-center text-xs text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin mr-2" /> Carregando mapa…
                  </div>
                }
              >
                <PreviewPolygonsMap
                  features={features}
                  backgroundGeoJSON={backgroundGeoJSON}
                  highlightCodigo={highlightCodigo}
                  mapClassName="h-[240px]"
                />
              </Suspense>

              {/* Feature list */}
              <div className="border rounded-lg divide-y divide-border/40 max-h-[200px] overflow-y-auto">
                {features.map((f, i) => {
                  const err = result?.erros.find(
                    (e) => e.codigo === f.codigo.trim().toUpperCase(),
                  );
                  const ok =
                    result &&
                    !err &&
                    result.criados?.includes(f.codigo.trim().toUpperCase());
                  return (
                    <div
                      key={f.tempId}
                      className={cn(
                        'flex items-center gap-2 px-3 py-1.5 text-xs',
                        highlightId === f.tempId && 'bg-amber-50/50 dark:bg-amber-950/20',
                      )}
                      onMouseEnter={() => setHighlightId(f.tempId)}
                      onMouseLeave={() => setHighlightId(null)}
                    >
                      <span className="text-muted-foreground w-5 shrink-0 tabular-nums">
                        {i + 1}.
                      </span>
                      <Input
                        value={f.codigo}
                        onChange={(e) => handleCodeChange(f.tempId, e.target.value)}
                        className={cn(
                          'h-6 w-24 text-xs font-mono px-1.5 shrink-0',
                          err && 'border-red-400',
                          ok && 'border-emerald-400',
                        )}
                        disabled={!!result}
                      />
                      {/* Detected region */}
                      {f.regiaoNomeDetectada && !result && (
                        <span className="text-[10px] text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30 px-1.5 py-0.5 rounded shrink-0">
                          {f.regiaoNomeDetectada}
                        </span>
                      )}
                      {!f.regiaoNomeDetectada && !result && (
                        <span className="text-[10px] text-amber-600 shrink-0">
                          PostGIS detectará
                        </span>
                      )}
                      {err && (
                        <span className="flex items-center gap-1 text-red-600 min-w-0 flex-1">
                          <XCircle className="h-3 w-3 shrink-0" />
                          <span className="truncate">{err.motivo}</span>
                        </span>
                      )}
                      {ok && (
                        <span className="flex items-center gap-1 text-emerald-600 ml-auto">
                          <CheckCircle2 className="h-3 w-3" />
                          importado
                        </span>
                      )}
                      {!result && (
                        <button
                          type="button"
                          onClick={() => handleRemove(f.tempId)}
                          className="ml-auto shrink-0 text-muted-foreground/50 hover:text-destructive transition-colors"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Result summary */}
              {result && (
                <div className="flex gap-2 flex-wrap">
                  {result.ok > 0 && (
                    <Badge className="bg-emerald-100 text-emerald-800 border-transparent">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      {result.ok} importado(s)
                    </Badge>
                  )}
                  {result.erros.length > 0 && (
                    <Badge className="bg-red-100 text-red-800 border-transparent">
                      <XCircle className="h-3 w-3 mr-1" />
                      {result.erros.length} com erro
                    </Badge>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter className="flex-shrink-0">
          <Button variant="outline" onClick={handleClose}>
            {result ? 'Fechar' : 'Cancelar'}
          </Button>
          {hasFeatures && !result && (
            <Button
              onClick={handleImportar}
              disabled={importar.isPending || features.length === 0}
            >
              {importar.isPending && (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              )}
              Importar {features.length} quarteirão(ões)
            </Button>
          )}
          {result && result.erros.length > 0 && (
            <Button variant="outline" onClick={handleReset}>
              Tentar novamente
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
