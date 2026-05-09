import { useState, useMemo, useEffect, lazy, Suspense } from 'react';
import { Loader2, MapPin, PenLine, Wand2, CheckSquare, Square, AlertTriangle } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  useImportarGeoJSONQuarteiroes,
  useGerarQuadrasOSM,
  useQuadrasList,
  type QuadraCandidataOSM,
} from '@/hooks/queries/useGestaoQuadras';
import { useClienteAtivo } from '@/hooks/useClienteAtivo';

const DrawPolygonMap = lazy(() => import('@/components/map/DrawPolygonMap'));
const PreviewQuadrasOSMMap = lazy(() => import('./PreviewQuadrasOSMMap'));

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
  regiaoIdInicial?: string | null;
  onClose: () => void;
  onSalvo?: () => void;
}

function nomeRegiao(r: RegiaoParaDesenho): string {
  return r.nome ?? r.regiao ?? r.id;
}

function fmtArea(m2: number): string {
  if (m2 >= 10000) return `${(m2 / 10000).toFixed(2)} ha`;
  return `${m2.toLocaleString('pt-BR')} m²`;
}

export function ModalDesenharQuarteirao({ open, regioes, regiaoIdInicial, onClose, onSalvo }: Props) {
  const importar = useImportarGeoJSONQuarteiroes();
  const gerarOSM = useGerarQuadrasOSM();
  const { clienteId, clienteAtivo } = useClienteAtivo();
  const { data: quadrasExistentes } = useQuadrasList(clienteId);

  const existingCodes = useMemo(
    () => new Set((quadrasExistentes ?? []).map(q => q.codigo)),
    [quadrasExistentes],
  );

  type Etapa = 'desenho' | 'preview';
  const [etapa, setEtapa] = useState<Etapa>('desenho');
  const [regiaoId, setRegiaoId] = useState(regiaoIdInicial ?? '');
  const [prefixo, setPrefixo] = useState('Q');
  const [geojson, setGeojson] = useState<Record<string, unknown> | null>(null);
  const [candidatos, setCandidatos] = useState<QuadraCandidataOSM[]>([]);
  const [codigos, setCodigos] = useState<Record<string, string>>({});
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());

  const regiao = useMemo(() => regioes.find((r) => r.id === regiaoId) ?? null, [regioes, regiaoId]);

  // Conjunto dos candidatos cujo código editado atual já existe no sistema
  const duplicatas = useMemo(
    () => new Set(
      candidatos
        .filter(c => existingCodes.has(codigos[c.codigo] ?? c.codigo))
        .map(c => c.codigo),
    ),
    [candidatos, codigos, existingCodes],
  );

  const clienteCenter = useMemo<[number, number] | null>(() => {
    if (clienteAtivo?.latitude_centro && clienteAtivo?.longitude_centro)
      return [clienteAtivo.latitude_centro, clienteAtivo.longitude_centro];
    return null;
  }, [clienteAtivo]);

  const mapCenter = useMemo<[number, number]>(() => {
    if (regiao?.latitude && regiao?.longitude) return [regiao.latitude as number, regiao.longitude as number];
    return clienteCenter ?? [-15.78, -47.93];
  }, [regiao, clienteCenter]);

  useEffect(() => {
    if (open) {
      setRegiaoId(regiaoIdInicial ?? '');
      setGeojson(null);
      setPrefixo('Q');
      setCandidatos([]);
      setCodigos({});
      setSelecionadas(new Set());
      setEtapa('desenho');
    }
  }, [open, regiaoIdInicial]);

  function handleClose() {
    setGeojson(null);
    onClose();
  }

  function handleGerar() {
    if (!regiaoId) { toast.error('Selecione uma região'); return; }
    if (!geojson) { toast.error('Desenhe o polígono da área a analisar'); return; }
    const p = prefixo.trim().toUpperCase() || 'Q';
    gerarOSM.mutate(
      { regiaoId, geojson: geojson as { type: 'Polygon'; coordinates: number[][][] }, prefixo: p },
      {
        onSuccess: (data) => {
          if (data.candidatos.length === 0) {
            toast.warning('Nenhuma quadra candidata gerada. Tente uma área maior ou com mais vias.');
            return;
          }
          const map: Record<string, string> = {};
          data.candidatos.forEach(c => { map[c.codigo] = c.codigo; });
          const novas = data.candidatos.filter(c => !existingCodes.has(c.codigo));
          const jaExistem = data.candidatos.length - novas.length;
          setCandidatos(data.candidatos);
          setCodigos(map);
          setSelecionadas(new Set(novas.map(c => c.codigo)));
          setEtapa('preview');
          const msg = `${data.candidatos.length} quadras geradas (${data.totalViasEncontradas} vias OSM)`;
          toast.success(jaExistem > 0 ? `${msg} — ${jaExistem} já existem e foram desmarcadas` : msg);
        },
        onError: (err: unknown) => toast.error((err as { message?: string })?.message ?? 'Erro ao consultar OSM'),
      },
    );
  }

  function handleSalvar() {
    const aptas = candidatos.filter(c => selecionadas.has(c.codigo) && !duplicatas.has(c.codigo));
    const ignoradas = candidatos.filter(c => selecionadas.has(c.codigo) && duplicatas.has(c.codigo));
    if (ignoradas.length > 0)
      toast.warning(`${ignoradas.length} quadra${ignoradas.length !== 1 ? 's' : ''} ignorada${ignoradas.length !== 1 ? 's' : ''} — código já cadastrado`);
    if (aptas.length === 0) { toast.error('Nenhuma quadra nova para salvar'); return; }
    const features = aptas
      .map(c => ({ codigo: codigos[c.codigo] ?? c.codigo, geojson: c.geojson as Record<string, unknown>, regiaoId, areaM2: c.areaM2 }));

    importar.mutate({ features }, {
      onSuccess: (res) => {
        toast.success(`${res.ok ?? features.length} quadras salvas`);
        if (res.erros?.length) toast.warning(`${res.erros.length} quadras com erro`);
        onSalvo?.();
        handleClose();
      },
      onError: (err: unknown) => toast.error((err as { message?: string })?.message ?? 'Erro ao salvar'),
    });
  }

  function toggleSelecionada(c: string) {
    setSelecionadas(prev => { const n = new Set(prev); n.has(c) ? n.delete(c) : n.add(c); return n; });
  }

  function toggleTodas() {
    const novas = candidatos.filter(c => !duplicatas.has(c.codigo)).map(c => c.codigo);
    setSelecionadas(prev =>
      novas.length > 0 && novas.every(c => prev.has(c)) ? new Set() : new Set(novas),
    );
  }

  const totalSel = selecionadas.size;
  const totalAptas = candidatos.filter(c => selecionadas.has(c.codigo) && !duplicatas.has(c.codigo)).length;
  const isPending = gerarOSM.isPending || importar.isPending;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PenLine className="h-4 w-4" />
            Gerar quadras pelo OpenStreetMap
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Região + Prefixo — só na etapa de desenho */}
          {etapa === 'desenho' && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Região / Bairro *</Label>
                <Select value={regiaoId} onValueChange={(v) => { setRegiaoId(v); setGeojson(null); }}>
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
                <Label htmlFor="osm-prefixo">Prefixo dos códigos</Label>
                <Input
                  id="osm-prefixo"
                  placeholder="Ex: Q, A, BNS"
                  value={prefixo}
                  onChange={(e) => setPrefixo(e.target.value.toUpperCase())}
                  maxLength={10}
                />
                <p className="text-[10px] text-muted-foreground">Gera: {prefixo || 'Q'}001, {prefixo || 'Q'}002…</p>
              </div>
            </div>
          )}

          {/* Avisos sobre geometria da região */}
          {etapa === 'desenho' && regiao?.geojson && (
            <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
              <MapPin className="h-3.5 w-3.5 text-green-600 shrink-0 mt-0.5" />
              <span>
                Limite de <strong>{nomeRegiao(regiao)}</strong> exibido em verde tracejado.
                Desenhe a área a analisar — pode ser o bairro inteiro.
              </span>
            </div>
          )}
          {etapa === 'desenho' && regiaoId && !regiao?.geojson && (
            <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>Esta região não tem geometria cadastrada. Desenhe o polígono da área de análise.</span>
            </div>
          )}

          {/* Mapa de desenho */}
          {etapa === 'desenho' && (
            <>
              <p className="text-xs text-muted-foreground">
                Desenhe o polígono da área. O sistema buscará a malha viária do OSM e gerará os quarteirões entre as ruas.
              </p>
              <Suspense fallback={
                <div className="h-[360px] rounded-lg border bg-muted/30 flex items-center justify-center text-xs text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando mapa…
                </div>
              }>
                <DrawPolygonMap
                  value={geojson as { type: 'Polygon'; coordinates: number[][][] } | null}
                  onChange={(g) => setGeojson(g as Record<string, unknown> | null)}
                  center={mapCenter}
                  backgroundGeoJSON={regiao?.geojson ?? null}
                  mapClassName="h-[360px]"
                />
              </Suspense>
            </>
          )}

          {/* Preview das quadras candidatas */}
          {etapa === 'preview' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">
                  {candidatos.length} quadras candidatas
                  <span className="text-xs text-muted-foreground ml-2">({totalSel} selecionadas)</span>
                  {duplicatas.size > 0 && (
                    <span className="text-xs text-destructive ml-2">· {duplicatas.size} já existem</span>
                  )}
                </p>
                <div className="flex gap-3">
                  <button type="button" onClick={toggleTodas} className="text-xs text-primary hover:underline">
                    {totalSel === candidatos.length ? 'Desmarcar todas' : 'Selecionar todas'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setEtapa('desenho'); setGeojson(null); }}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    ← Redesenhar
                  </button>
                </div>
              </div>

              <Suspense fallback={
                <div className="h-[260px] rounded-lg border bg-muted/30 flex items-center justify-center text-xs text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" /> Carregando mapa…
                </div>
              }>
                <PreviewQuadrasOSMMap candidatos={candidatos} selecionadas={selecionadas} onToggle={toggleSelecionada} center={clienteCenter ?? undefined} />
              </Suspense>

              <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
                {candidatos.map((c) => {
                  const sel = selecionadas.has(c.codigo);
                  const dup = duplicatas.has(c.codigo);
                  return (
                    <div
                      key={c.codigo}
                      className={cn(
                        'flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-muted/30 transition-colors',
                        sel && !dup && 'bg-primary/5',
                        dup && 'bg-destructive/5 opacity-60',
                      )}
                      onClick={() => !dup && toggleSelecionada(c.codigo)}
                    >
                      {dup
                        ? <Square className="h-3.5 w-3.5 text-destructive shrink-0" />
                        : sel
                          ? <CheckSquare className="h-3.5 w-3.5 text-primary shrink-0" />
                          : <Square className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                      <Input
                        value={codigos[c.codigo] ?? c.codigo}
                        onChange={(e) => { e.stopPropagation(); setCodigos(prev => ({ ...prev, [c.codigo]: e.target.value.toUpperCase() })); }}
                        onClick={(e) => e.stopPropagation()}
                        className={cn('h-6 text-xs font-mono w-28 shrink-0', dup && 'border-destructive/50')}
                        disabled={dup}
                      />
                      <Badge variant="outline" className="text-[10px] h-5 shrink-0">
                        {fmtArea(c.areaM2)}
                      </Badge>
                      {dup && (
                        <Badge variant="destructive" className="text-[10px] h-5 shrink-0">já existe</Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose} disabled={isPending}>Cancelar</Button>

          {etapa === 'desenho' && (
            <Button onClick={handleGerar} disabled={isPending || !regiaoId || !geojson}>
              {gerarOSM.isPending
                ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Consultando OSM…</>
                : <><Wand2 className="h-4 w-4 mr-2" /> Gerar quadras</>}
            </Button>
          )}

          {etapa === 'preview' && (
            <Button onClick={handleSalvar} disabled={importar.isPending || totalAptas === 0}>
              {importar.isPending
                ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Salvando…</>
                : `Salvar ${totalAptas} quadra${totalAptas !== 1 ? 's' : ''}`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
