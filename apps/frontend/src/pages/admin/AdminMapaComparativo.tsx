import { useState, useEffect } from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { HeatmapLayer } from '@/components/map-v3/HeatmapLayer';
import { useClienteAtivo } from '@/hooks/useClienteAtivo';
import { useLevantamentos } from '@/hooks/queries/useLevantamentos';
import { api } from '@/services/api';
import { LevantamentoItem } from '@/types/database';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { GitCompare, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

type ActiveView = 'A' | 'B' | 'split';

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function computeStats(items: LevantamentoItem[]) {
  const total = items.length;
  const criticos = items.filter(
    (i) => (i.risco || '').toLowerCase() === 'critico' || (i.risco || '').toLowerCase() === 'crítico'
  ).length;
  const pctCriticos = total > 0 ? Math.round((criticos / total) * 100) : 0;
  return { total, criticos, pctCriticos };
}

interface MapPanelProps {
  items: LevantamentoItem[];
  label: string;
  center: [number, number];
  zoom: number;
}

function MapPanel({ items, label, center, zoom }: MapPanelProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 mb-2">
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">
          {label}
        </span>
        <span className="text-sm font-medium text-muted-foreground">
          {items.length} {items.length === 1 ? 'item' : 'itens'}
        </span>
      </div>
      <div className="flex-1 rounded-xl overflow-hidden border border-border min-h-[300px] isolate">
        <MapContainer
          center={center}
          zoom={zoom}
          className="h-full w-full"
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {items.length > 0 && <HeatmapLayer items={items} />}
        </MapContainer>
      </div>
    </div>
  );
}

export default function AdminMapaComparativo() {
  const { clienteId, clienteAtivo } = useClienteAtivo();
  const isMobile = useIsMobile();

  const { data: levantamentos = [] } = useLevantamentos(clienteId);

  const [levAId, setLevAId] = useState<string | undefined>();
  const [levBId, setLevBId] = useState<string | undefined>();
  const [activeView, setActiveView] = useState<ActiveView>('A');

  // Force back to 'A' when switching to mobile while in split mode
  useEffect(() => {
    if (isMobile && activeView === 'split') {
      setActiveView('A');
    }
  }, [isMobile, activeView]);

  const { data: itensA = [] } = useQuery<LevantamentoItem[]>({
    queryKey: ['itens_comparativo_a', levAId],
    queryFn: () => api.itens.listByLevantamento(levAId!),
    enabled: !!levAId,
  });

  const { data: itensB = [] } = useQuery<LevantamentoItem[]>({
    queryKey: ['itens_comparativo_b', levBId],
    queryFn: () => api.itens.listByLevantamento(levBId!),
    enabled: !!levBId,
  });

  const center: [number, number] =
    clienteAtivo?.latitude_centro != null && clienteAtivo?.longitude_centro != null
      ? [clienteAtivo.latitude_centro, clienteAtivo.longitude_centro]
      : [-15.78, -47.93];

  const statsA = computeStats(itensA);
  const statsB = computeStats(itensB);

  const levALabel = levantamentos.find((l) => l.id === levAId)?.titulo ?? '';
  const levBLabel = levantamentos.find((l) => l.id === levBId)?.titulo ?? '';

  const levADate = levantamentos.find((l) => l.id === levAId)?.created_at ?? '';
  const levBDate = levantamentos.find((l) => l.id === levBId)?.created_at ?? '';

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <GitCompare className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Mapa Antes/Depois</h1>
          <p className="text-sm text-muted-foreground">Compare dois levantamentos lado a lado no mapa de calor</p>
        </div>
      </div>

      {/* Selects + Toggle */}
      <Card>
        <CardContent className="pt-5 pb-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            {/* Select A */}
            <div className="flex-1 w-full sm:w-auto">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">
                Levantamento A
              </label>
              <Select value={levAId ?? ''} onValueChange={(v) => setLevAId(v || undefined)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione o levantamento A" />
                </SelectTrigger>
                <SelectContent>
                  {levantamentos.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.titulo}
                      {l.created_at && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          {formatDate(l.created_at)}
                        </span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Toggle */}
            <div className="flex flex-col items-center gap-1 shrink-0">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Visualização
              </label>
              <div className="flex items-center rounded-lg border border-border overflow-hidden">
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    'rounded-none px-4 h-9 font-semibold border-r border-border',
                    activeView === 'A' && 'bg-primary text-primary-foreground hover:bg-primary/90'
                  )}
                  onClick={() => setActiveView('A')}
                >
                  A
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    'rounded-none px-4 h-9 font-semibold border-r border-border',
                    activeView === 'B' && 'bg-primary text-primary-foreground hover:bg-primary/90'
                  )}
                  onClick={() => setActiveView('B')}
                >
                  B
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  title={isMobile ? 'Disponível apenas em desktop' : undefined}
                  className={cn(
                    'rounded-none px-3 h-9 gap-1.5',
                    activeView === 'split' && 'bg-primary text-primary-foreground hover:bg-primary/90',
                    isMobile && 'opacity-40 cursor-not-allowed'
                  )}
                  onClick={() => {
                    if (!isMobile) setActiveView('split');
                  }}
                  disabled={isMobile}
                >
                  <Layers className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline text-xs">Dividido</span>
                </Button>
              </div>
            </div>

            {/* Select B */}
            <div className="flex-1 w-full sm:w-auto">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">
                Levantamento B
              </label>
              <Select value={levBId ?? ''} onValueChange={(v) => setLevBId(v || undefined)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione o levantamento B" />
                </SelectTrigger>
                <SelectContent>
                  {levantamentos.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.titulo}
                      {l.created_at && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          {formatDate(l.created_at)}
                        </span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Map area */}
      {activeView === 'split' ? (
        /* Split view: side-by-side (desktop only) */
        <div className="hidden lg:grid grid-cols-2 gap-4" style={{ height: '520px' }}>
          <Card className="flex flex-col overflow-hidden">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-base flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">A</span>
                {levALabel || 'Levantamento A'}
                {levADate && <span className="text-xs text-muted-foreground font-normal ml-1">{formatDate(levADate)}</span>}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 p-2 overflow-hidden">
              <div className="h-full rounded-xl overflow-hidden border border-border">
                <MapContainer
                  center={center}
                  zoom={13}
                  className="h-full w-full"
                  style={{ height: '100%', width: '100%' }}
                  scrollWheelZoom
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  {itensA.length > 0 && <HeatmapLayer items={itensA} />}
                </MapContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="flex flex-col overflow-hidden">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-base flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">B</span>
                {levBLabel || 'Levantamento B'}
                {levBDate && <span className="text-xs text-muted-foreground font-normal ml-1">{formatDate(levBDate)}</span>}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 p-2 overflow-hidden">
              <div className="h-full rounded-xl overflow-hidden border border-border">
                <MapContainer
                  center={center}
                  zoom={13}
                  className="h-full w-full"
                  style={{ height: '100%', width: '100%' }}
                  scrollWheelZoom
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  {itensB.length > 0 && <HeatmapLayer items={itensB} />}
                </MapContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        /* Single view: A or B */
        <Card className="overflow-hidden">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-base flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">
                {activeView}
              </span>
              {activeView === 'A'
                ? levALabel || 'Levantamento A'
                : levBLabel || 'Levantamento B'}
              {activeView === 'A' && levADate && (
                <span className="text-xs text-muted-foreground font-normal ml-1">{formatDate(levADate)}</span>
              )}
              {activeView === 'B' && levBDate && (
                <span className="text-xs text-muted-foreground font-normal ml-1">{formatDate(levBDate)}</span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2">
            <div className="rounded-xl overflow-hidden border border-border" style={{ height: '480px' }}>
              <MapContainer
                center={center}
                zoom={13}
                className="h-full w-full"
                style={{ height: '100%', width: '100%' }}
                scrollWheelZoom
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {activeView === 'A' && itensA.length > 0 && <HeatmapLayer items={itensA} />}
                {activeView === 'B' && itensB.length > 0 && <HeatmapLayer items={itensB} />}
              </MapContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">A</span>
              {levALabel || 'Levantamento A'}
              {levADate && <span className="text-xs text-muted-foreground font-normal">{formatDate(levADate)}</span>}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {!levAId ? (
              <p className="text-sm text-muted-foreground">Nenhum levantamento selecionado</p>
            ) : (
              <div className="flex items-center gap-6">
                <div>
                  <p className="text-2xl font-bold">{statsA.total}</p>
                  <p className="text-xs text-muted-foreground">Total de itens</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-destructive">{statsA.criticos}</p>
                  <p className="text-xs text-muted-foreground">Críticos</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{statsA.pctCriticos}%</p>
                  <p className="text-xs text-muted-foreground">% críticos</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">B</span>
              {levBLabel || 'Levantamento B'}
              {levBDate && <span className="text-xs text-muted-foreground font-normal">{formatDate(levBDate)}</span>}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {!levBId ? (
              <p className="text-sm text-muted-foreground">Nenhum levantamento selecionado</p>
            ) : (
              <div className="flex items-center gap-6">
                <div>
                  <p className="text-2xl font-bold">{statsB.total}</p>
                  <p className="text-xs text-muted-foreground">Total de itens</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-destructive">{statsB.criticos}</p>
                  <p className="text-xs text-muted-foreground">Críticos</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{statsB.pctCriticos}%</p>
                  <p className="text-xs text-muted-foreground">% críticos</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
