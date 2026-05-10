import { useState, useMemo, useEffect, lazy, Suspense } from 'react';
import {
  Loader2, MapPin, PenLine, Wand2, CheckSquare, Square,
  AlertTriangle, ArrowLeft, ChevronRight, Map,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
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
import { useQueryClient } from '@tanstack/react-query';
import {
  useImportarGeoJSONQuarteiroes,
  useGerarQuadrasOSM,
  useQuadrasList,
  type QuadraCandidataOSM,
} from '@/hooks/queries/useGestaoQuadras';
import { useClienteAtivo } from '@/hooks/useClienteAtivo';
import { api } from '@/services/api';

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
  bairroIdInicial?: string | null;
  onClose: () => void;
  onSalvo?: () => void;
}

function nomeRegiao(r: RegiaoParaDesenho): string {
  return r.nome ?? r.regiao ?? r.id;
}

function fmtArea(m2: number): string {
  return `${Math.round(m2).toLocaleString('pt-BR')} m²`;
}

export function ModalDesenharQuarteirao({ open, regioes, bairroIdInicial, onClose, onSalvo }: Props) {
  const importar = useImportarGeoJSONQuarteiroes();
  const gerarOSM = useGerarQuadrasOSM();
  const { clienteId, clienteAtivo } = useClienteAtivo();
  const queryClient = useQueryClient();
  const { data: quadrasExistentes } = useQuadrasList(clienteId);

  const existingCodes = useMemo(
    () => new Set((quadrasExistentes ?? []).map(q => q.codigo)),
    [quadrasExistentes],
  );

  type Etapa = 'desenho' | 'preview';
  const [etapa, setEtapa] = useState<Etapa>('desenho');
  const [bairroId, setBairroId] = useState(bairroIdInicial ?? '');
  const [prefixo, setPrefixo] = useState('Q');
  const [geojson, setGeojson] = useState<Record<string, unknown> | null>(null);
  const [candidatos, setCandidatos] = useState<QuadraCandidataOSM[]>([]);
  const [codigos, setCodigos] = useState<Record<string, string>>({});
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());

  const regiao = useMemo(() => regioes.find((r) => r.id === bairroId) ?? null, [regioes, bairroId]);

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
      const id = bairroIdInicial ?? '';
      setBairroId(id);
      const r = id ? regioes.find((x) => x.id === id) ?? null : null;
      setGeojson(r?.geojson ? (r.geojson as Record<string, unknown>) : null);
      setPrefixo('Q');
      setCandidatos([]);
      setCodigos({});
      setSelecionadas(new Set());
      setEtapa('desenho');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, bairroIdInicial]);

  function handleClose() {
    setGeojson(null);
    onClose();
  }

  function handleBairroChange(v: string) {
    setBairroId(v);
    const r = regioes.find((x) => x.id === v) ?? null;
    setGeojson(r?.geojson ? (r.geojson as Record<string, unknown>) : null);
  }

  function handleGerar() {
    if (!bairroId) { toast.error('Selecione uma região'); return; }
    if (!geojson) { toast.error('Desenhe o polígono da área a analisar'); return; }

    // Persiste o polígono no cadastro do bairro (fire-and-forget)
    if (regiao) {
      api.regioes.update(bairroId, {
        nome: nomeRegiao(regiao),
        latitude: regiao.latitude ?? undefined,
        longitude: regiao.longitude ?? undefined,
        geojson,
      })
        .then(() => queryClient.invalidateQueries({ queryKey: ['regioes', clienteId] }))
        .catch(() => { /* silencioso */ });
    }

    const p = prefixo.trim().toUpperCase() || 'Q';
    gerarOSM.mutate(
      { bairroId, geojson: geojson as { type: 'Polygon'; coordinates: number[][][] }, prefixo: p },
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
      .map(c => ({ codigo: codigos[c.codigo] ?? c.codigo, geojson: c.geojson as Record<string, unknown>, bairroId, areaM2: c.areaM2 }));

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

  const statusText = etapa === 'desenho'
    ? geojson
      ? 'Polígono definido — pronto para gerar'
      : bairroId
        ? 'Ajuste o polígono no mapa'
        : 'Selecione um bairro para começar'
    : `${totalAptas} quadra${totalAptas !== 1 ? 's' : ''} nova${totalAptas !== 1 ? 's' : ''} para salvar`;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-5xl p-0 max-h-[94vh] flex flex-col gap-0 overflow-hidden">

        {/* ── Cabeçalho ─────────────────────────────────────────────── */}
        <div className="flex items-start justify-between px-6 pt-4 pb-3 border-b shrink-0">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-primary/10 shrink-0 mt-0.5">
              <PenLine className="h-4 w-4 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold leading-tight">
                Gerar quadras via OpenStreetMap
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Defina o limite do bairro — o sistema gera quadras pela malha viária automaticamente
              </p>
            </div>
          </div>

          {/* Indicador de etapas */}
          <div className="flex items-center gap-1 shrink-0 ml-4">
            <div className={cn(
              'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors',
              etapa === 'desenho'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground',
            )}>
              <Map className="h-3 w-3" />
              <span>Área</span>
            </div>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            <div className={cn(
              'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors',
              etapa === 'preview'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground',
            )}>
              <CheckSquare className="h-3 w-3" />
              <span>Revisar</span>
            </div>
          </div>
        </div>

        {/* ── Conteúdo (scroll) ──────────────────────────────────────── */}
        <div className="flex-1 min-h-0 overflow-y-auto px-6 pt-3 pb-4 space-y-3">

          {/* Etapa 1 — Definição de área */}
          {etapa === 'desenho' && (
            <>
              <div className="grid grid-cols-[1fr_170px] gap-3 items-end">
                <div className="space-y-1.5">
                  <Label>Região / Bairro *</Label>
                  <Select value={bairroId} onValueChange={handleBairroChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma região…" />
                    </SelectTrigger>
                    <SelectContent>
                      {regioes.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          <span className="flex items-center gap-2">
                            <span className={cn(
                              'w-2 h-2 rounded-full shrink-0',
                              r.geojson ? 'bg-green-500' : 'bg-muted-foreground/30',
                            )} />
                            {nomeRegiao(r)}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="osm-prefixo">
                    Prefixo dos códigos
                  </Label>
                  <Input
                    id="osm-prefixo"
                    placeholder="Ex: Q, A, BNS"
                    value={prefixo}
                    onChange={(e) => setPrefixo(e.target.value.toUpperCase())}
                    maxLength={10}
                  />
                  <p className="text-[10px] text-muted-foreground leading-tight">
                    Gera: <span className="font-mono">{prefixo || 'Q'}001</span>, <span className="font-mono">{prefixo || 'Q'}002</span>…
                  </p>
                </div>
              </div>

              {/* Banner — bairro com geojson */}
              {bairroId && regiao?.geojson && (
                <div className="flex items-start gap-2.5 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg px-3.5 py-2.5">
                  <MapPin className="h-3.5 w-3.5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-green-800 dark:text-green-300 leading-relaxed">
                    Limite de <strong>{nomeRegiao(regiao)}</strong> carregado e exibido em verde tracejado.
                    {' '}Ajuste o polígono se necessário antes de gerar.
                  </p>
                </div>
              )}

              {/* Banner — bairro sem geojson */}
              {bairroId && !regiao?.geojson && (
                <div className="flex items-start gap-2.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg px-3.5 py-2.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                    Este bairro ainda não tem limite cadastrado.{' '}
                    <strong>Desenhe o polígono</strong> — ele será salvo automaticamente no cadastro ao gerar as quadras.
                  </p>
                </div>
              )}

              {/* Mapa */}
              <Suspense fallback={
                <div className="h-[560px] rounded-lg border bg-muted/30 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" /> Carregando mapa…
                </div>
              }>
                <DrawPolygonMap
                  value={geojson as { type: 'Polygon'; coordinates: number[][][] } | null}
                  onChange={(g) => setGeojson(g as Record<string, unknown> | null)}
                  center={mapCenter}
                  backgroundGeoJSON={regiao?.geojson ?? null}
                  mapClassName="h-[560px]"
                />
              </Suspense>
            </>
          )}

          {/* Etapa 2 — Preview das quadras */}
          {etapa === 'preview' && (
            <div className="space-y-3">

              {/* Cabeçalho do preview */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary" className="gap-1.5 text-xs">
                    <Map className="h-3 w-3" />
                    {candidatos.length} candidatas
                  </Badge>
                  <Badge variant="outline" className="gap-1.5 text-xs text-primary border-primary/30 bg-primary/5">
                    <CheckSquare className="h-3 w-3" />
                    {totalSel} selecionadas
                  </Badge>
                  {duplicatas.size > 0 && (
                    <Badge variant="destructive" className="gap-1.5 text-xs">
                      {duplicatas.size} já existem
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={toggleTodas}
                    className="h-7 text-xs px-3"
                  >
                    {totalSel === candidatos.filter(c => !duplicatas.has(c.codigo)).length
                      ? 'Desmarcar todas'
                      : 'Selecionar novas'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => { setEtapa('desenho'); setGeojson(null); }}
                    className="h-7 text-xs gap-1.5"
                  >
                    <ArrowLeft className="h-3 w-3" />
                    Redesenhar
                  </Button>
                </div>
              </div>

              {/* Mapa preview */}
              <Suspense fallback={
                <div className="h-[340px] rounded-lg border bg-muted/30 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Carregando mapa…
                </div>
              }>
                <PreviewQuadrasOSMMap
                  candidatos={candidatos}
                  selecionadas={selecionadas}
                  onToggle={toggleSelecionada}
                  center={clienteCenter ?? undefined}
                />
              </Suspense>

              {/* Lista de quadras */}
              <div className="border rounded-lg divide-y max-h-44 overflow-y-auto">
                {candidatos.map((c) => {
                  const sel = selecionadas.has(c.codigo);
                  const dup = duplicatas.has(c.codigo);
                  return (
                    <div
                      key={c.codigo}
                      className={cn(
                        'flex items-center gap-2.5 px-3 py-2 transition-colors select-none',
                        !dup && 'cursor-pointer hover:bg-muted/40',
                        sel && !dup && 'bg-primary/5',
                        dup && 'opacity-50 cursor-not-allowed bg-destructive/5',
                      )}
                      onClick={() => !dup && toggleSelecionada(c.codigo)}
                    >
                      {/* Checkbox visual */}
                      <div className={cn(
                        'w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center',
                        dup
                          ? 'border-destructive/40'
                          : sel
                            ? 'border-primary bg-primary'
                            : 'border-muted-foreground/40',
                      )}>
                        {sel && !dup && <CheckSquare className="h-3 w-3 text-primary-foreground" />}
                        {dup && <Square className="h-3 w-3 text-destructive/50" />}
                      </div>

                      <Input
                        value={codigos[c.codigo] ?? c.codigo}
                        onChange={(e) => {
                          e.stopPropagation();
                          setCodigos(prev => ({ ...prev, [c.codigo]: e.target.value.toUpperCase() }));
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className={cn('h-6 text-xs font-mono w-28 shrink-0', dup && 'border-destructive/30 text-muted-foreground')}
                        disabled={dup}
                      />

                      <span className="text-xs text-muted-foreground">{fmtArea(c.areaM2)}</span>

                      {dup && (
                        <Badge variant="destructive" className="text-[10px] h-5 ml-auto shrink-0">
                          já existe
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── Rodapé ─────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-t bg-muted/20 shrink-0">
          <p className="text-xs text-muted-foreground truncate">{statusText}</p>

          <div className="flex items-center gap-2 shrink-0">
            <Button variant="ghost" size="sm" onClick={handleClose} disabled={isPending}>
              Cancelar
            </Button>

            {etapa === 'desenho' && (
              <Button
                size="sm"
                onClick={handleGerar}
                disabled={isPending || !bairroId || !geojson}
                className="gap-2 min-w-[140px]"
              >
                {gerarOSM.isPending
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Consultando OSM…</>
                  : <><Wand2 className="h-4 w-4" /> Gerar quadras</>}
              </Button>
            )}

            {etapa === 'preview' && (
              <Button
                size="sm"
                onClick={handleSalvar}
                disabled={importar.isPending || totalAptas === 0}
                className="gap-2 min-w-[140px]"
              >
                {importar.isPending
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Salvando…</>
                  : <><CheckSquare className="h-4 w-4" /> Salvar {totalAptas} quadra{totalAptas !== 1 ? 's' : ''}</>}
              </Button>
            )}
          </div>
        </div>

      </DialogContent>
    </Dialog>
  );
}
