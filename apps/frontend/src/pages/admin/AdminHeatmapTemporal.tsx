import { useState, useMemo, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import { HeatmapLayer } from '@/components/map-v3/HeatmapLayer';
import { useClienteAtivo } from '@/hooks/useClienteAtivo';
import { useItensPorPeriodo } from '@/hooks/queries/useItensPorPeriodo';
import { LevantamentoItem } from '@/types/database';
import { forwardGeocode } from '@/lib/geo';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Play, Pause, Activity, AlertTriangle, CheckCircle, MapPin } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

const RISCO_OPTIONS = ['todos', 'critico', 'alto', 'medio', 'baixo'] as const;
type RiscoOption = (typeof RISCO_OPTIONS)[number];

const RISCO_LABEL: Record<RiscoOption, string> = {
  todos: 'Todos os riscos',
  critico: 'Crítico',
  alto: 'Alto',
  medio: 'Médio',
  baixo: 'Baixo',
};

const RISCO_COLOR: Record<string, string> = {
  critico: 'bg-red-500 text-white',
  alto: 'bg-orange-500 text-white',
  medio: 'bg-yellow-500 text-black',
  baixo: 'bg-green-500 text-white',
};

function calcSemana(semanaAtual: number) {
  const to = new Date();
  to.setDate(to.getDate() - semanaAtual * 7);
  to.setHours(23, 59, 59, 999);

  const from = new Date(to);
  from.setDate(from.getDate() - 6);
  from.setHours(0, 0, 0, 0);

  const label = `Semana de ${from.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  })} a ${to.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })}`;

  return { from: from.toISOString(), to: to.toISOString(), label };
}

function filtrarItens(items: LevantamentoItem[], risco: RiscoOption, tipoItem: string): LevantamentoItem[] {
  return items.filter((it) => {
    const riscoOk = risco === 'todos' || (it.risco || '').toLowerCase() === risco;
    const tipoOk = !tipoItem || (it.item || '').toLowerCase().includes(tipoItem.toLowerCase());
    return riscoOk && tipoOk;
  });
}

function calcStats(items: LevantamentoItem[]) {
  const total = items.length;
  const criticos = items.filter((it) => (it.risco || '').toLowerCase() === 'critico').length;
  const resolvidos = items.filter((it) => it.status_atendimento === 'resolvido').length;
  return { total, criticos, resolvidos };
}

export default function AdminHeatmapTemporal() {
  const { clienteId, clienteAtivo } = useClienteAtivo();
  const [clienteCenterFallback, setClienteCenterFallback] = useState<[number, number] | null>(null);

  const mapCenter: [number, number] = useMemo(() => {
    if (
      typeof clienteAtivo?.latitude_centro === 'number' &&
      typeof clienteAtivo?.longitude_centro === 'number'
    ) {
      return [clienteAtivo.latitude_centro, clienteAtivo.longitude_centro];
    }

    if (clienteCenterFallback) return clienteCenterFallback;

    // Último recurso: um ponto genérico do Brasil.
    return [-20.4697, -54.6201];
  }, [clienteAtivo?.latitude_centro, clienteAtivo?.longitude_centro, clienteCenterFallback]);

  const [semanaAtual, setSemanaAtual] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [riscoFiltro, setRiscoFiltro] = useState<RiscoOption>('todos');
  const [tipoItemFiltro, setTipoItemFiltro] = useState('');

  useEffect(() => {
    // Se o cliente já possui latitude/longitude do centro, não precisa geocodificar.
    if (
      typeof clienteAtivo?.latitude_centro === 'number' &&
      typeof clienteAtivo?.longitude_centro === 'number'
    ) {
      setClienteCenterFallback(null);
      return;
    }

    const cidade = clienteAtivo?.cidade?.trim();
    const uf = (clienteAtivo?.uf || clienteAtivo?.estado)?.trim();
    if (!cidade || !uf) return;

    let cancelado = false;
    (async () => {
      const query = [cidade, uf, 'Brasil'].filter(Boolean).join(', ');
      const result = await forwardGeocode(query).catch(() => null);
      if (!cancelado && result) {
        setClienteCenterFallback([result.lat, result.lng]);
      }
    })();

    return () => {
      cancelado = true;
    };
  }, [clienteAtivo?.cidade, clienteAtivo?.uf, clienteAtivo?.estado, clienteAtivo?.latitude_centro, clienteAtivo?.longitude_centro]);

  const { from, to, label } = useMemo(() => calcSemana(semanaAtual), [semanaAtual]);

  const { data: rawItems = [], isFetching } = useItensPorPeriodo(clienteId, from, to);

  const itensFiltrados = useMemo(
    () => filtrarItens(rawItems, riscoFiltro, tipoItemFiltro),
    [rawItems, riscoFiltro, tipoItemFiltro]
  );

  const stats = useMemo(() => calcStats(itensFiltrados), [itensFiltrados]);

  // Tipos únicos de item para o filtro de tipo
  const tiposDisponiveis = useMemo(() => {
    const set = new Set(rawItems.map((it) => it.item || '').filter(Boolean));
    return Array.from(set).sort();
  }, [rawItems]);

  // Auto-play: avança o slider a cada 1.5s
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => {
      setSemanaAtual((prev) => {
        if (prev >= 11) {
          setPlaying(false);
          return 11;
        }
        return prev + 1;
      });
    }, 1500);
    return () => clearInterval(timer);
  }, [playing]);

  const handleSliderChange = useCallback((value: number[]) => {
    setSemanaAtual(value[0]);
  }, []);

  const togglePlay = useCallback(() => {
    if (semanaAtual >= 11) {
      setSemanaAtual(0);
    }
    setPlaying((p) => !p);
  }, [semanaAtual]);

  return (
    <div className="flex flex-col gap-4">
      {/* Cabeçalho */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <Activity className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Heatmap Temporal</h1>
          <p className="text-sm text-muted-foreground">
            Visualize a evolução dos focos identificados semana a semana
          </p>
        </div>
      </div>

      {/* Painel de controles */}
      <Card>
        <CardContent className="pt-4 pb-4 flex flex-col gap-4">
          {/* Slider + Play/Pause */}
          <div className="flex items-center gap-4">
            <Button
              variant={playing ? 'destructive' : 'default'}
              size="sm"
              onClick={togglePlay}
              className="shrink-0 w-24"
            >
              {playing ? (
                <>
                  <Pause className="h-4 w-4 mr-1.5" /> Pausar
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-1.5" /> Play
                </>
              )}
            </Button>
            <div className="flex-1">
              <Slider
                min={0}
                max={11}
                step={1}
                value={[semanaAtual]}
                onValueChange={handleSliderChange}
              />
              <div className="flex justify-between mt-1 text-[10px] text-muted-foreground">
                <span>Semana atual</span>
                <span>12 semanas atrás</span>
              </div>
            </div>
          </div>

          {/* Label da semana + indicador de carregamento */}
          <div className="flex items-center gap-3 flex-wrap">
            <Badge variant="outline" className="text-sm font-semibold px-3 py-1">
              {label}
            </Badge>
            {isFetching && (
              <span className="text-xs text-muted-foreground animate-pulse">Carregando dados...</span>
            )}
          </div>

          {/* Filtros */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex gap-1.5 flex-wrap">
              {RISCO_OPTIONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRiscoFiltro(r)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                    riscoFiltro === r
                      ? r === 'todos'
                        ? 'bg-primary text-primary-foreground border-primary'
                        : RISCO_COLOR[r] + ' border-transparent'
                      : 'bg-background text-muted-foreground border-border hover:border-primary/50'
                  }`}
                >
                  {RISCO_LABEL[r]}
                </button>
              ))}
            </div>

            {tiposDisponiveis.length > 0 && (
              <select
                value={tipoItemFiltro}
                onChange={(e) => setTipoItemFiltro(e.target.value)}
                className="h-7 rounded-md border border-border bg-background px-2 text-xs text-foreground"
              >
                <option value="">Tipo: todos</option>
                {tiposDisponiveis.map((tipo) => (
                  <option key={tipo} value={tipo}>
                    {tipo}
                  </option>
                ))}
              </select>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Stats da semana */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-4 pb-4 flex items-center gap-3">
            <MapPin className="h-5 w-5 text-primary shrink-0" />
            <div>
              <p className="text-2xl font-bold leading-none">{stats.total}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Total de itens</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
            <div>
              <p className="text-2xl font-bold leading-none">{stats.criticos}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Críticos</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-green-500 shrink-0" />
            <div>
              <p className="text-2xl font-bold leading-none">{stats.resolvidos}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Resolvidos</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Mapa */}
      <div className="rounded-xl overflow-hidden border isolate" style={{ height: '520px' }}>
        <MapContainer
          key={`${mapCenter[0]}-${mapCenter[1]}`}
          center={mapCenter}
          zoom={12}
          style={{ height: '100%', width: '100%' }}
          zoomControl
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {itensFiltrados.length > 0 && (
            <HeatmapLayer items={itensFiltrados} radius={30} blur={20} />
          )}
        </MapContainer>
      </div>

      {/* Legenda de intensidade */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="font-semibold">Intensidade:</span>
        <div className="flex items-center gap-1">
          <span className="inline-block w-4 h-3 rounded-sm bg-green-500" />
          <span>Baixo</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="inline-block w-4 h-3 rounded-sm bg-yellow-400" />
          <span>Médio</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="inline-block w-4 h-3 rounded-sm bg-orange-500" />
          <span>Alto</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="inline-block w-4 h-3 rounded-sm bg-red-600" />
          <span>Crítico</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="inline-block w-4 h-3 rounded-sm bg-red-900" />
          <span>Muito alto</span>
        </div>
      </div>
    </div>
  );
}
