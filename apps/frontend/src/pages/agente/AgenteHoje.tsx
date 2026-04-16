import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  CheckCircle2, Clock, Ban, ChevronRight, WifiOff, AlertCircle,
  List, Map as MapIcon, Navigation, RefreshCw, RotateCcw, UserCheck, Route,
} from 'lucide-react';
import { toast } from 'sonner';
import { CicloBadge } from '@/components/foco/CicloBadge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FichaImovel } from '@/components/agente/FichaImovel';
import { useClienteAtivo } from '@/hooks/useClienteAtivo';
import { useAuth } from '@/hooks/useAuth';
import { useImoveisResumo } from '@/hooks/queries/useImoveis';
import { useAlertasRetorno } from '@/hooks/queries/useAlertasRetorno';
import { useFocosAtribuidos } from '@/hooks/queries/useFocosAtribuidos';
import { useReinspecoesPendentesAgente } from '@/hooks/queries/useReinspecoes';
import { ReinspecaoCard } from '@/components/foco/ReinspecaoCard';
import { PrioridadeBadge } from '@/components/foco/PrioridadeBadge';
import { SlaBadge } from '@/components/foco/SlaBadge';
import { useOfflineStatus } from '@/hooks/useOfflineStatus';
import { useOfflineQueue } from '@/hooks/useOfflineQueue';
import { SyncStatusPanel } from '@/components/SyncStatusPanel';
import { logEvento } from '@/lib/pilotoEventos';
import { resolveStatusImovel } from '@/lib/imovelStatus';
import { cn } from '@/lib/utils';
import type { ImovelResumo } from '@/types/database';

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  visitado: {
    label: 'Visitado',
    color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    mapColor: '#22c55e',
    icon: CheckCircle2,
  },
  pendente: {
    label: 'Pendente',
    color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    mapColor: '#ef4444',
    icon: Clock,
  },
  revisita: {
    label: 'Revisita',
    color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    mapColor: '#f59e0b',
    icon: Clock,
  },
  fechado: {
    label: 'Fechado',
    color: 'bg-gray-100 text-gray-500 dark:bg-gray-800/50 dark:text-gray-400',
    mapColor: '#6b7280',
    icon: Ban,
  },
} as const;

type StatusKey = keyof typeof STATUS_CONFIG;
type ListFiltro = 'todos' | 'atribuido' | 'pendente' | 'retorno' | 'visitado' | 'reinspecao';

const SCORE_BADGE_CLASSES: Record<string, string> = {
  alto: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  muito_alto: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  critico: 'bg-red-200 text-red-800 dark:bg-red-900/50 dark:text-red-300 font-bold',
};


// ─── Map legend ───────────────────────────────────────────────────────────────

const MAP_LEGEND = (
  Object.entries(STATUS_CONFIG) as [StatusKey, typeof STATUS_CONFIG[StatusKey]][]
).filter(([k]) => k !== 'fechado');

// ─── Rota: nearest-neighbor ───────────────────────────────────────────────────

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function nearestNeighborImoveis(
  items: ImovelResumo[],
  origemLat: number,
  origemLng: number,
): ImovelResumo[] {
  const comCoord = items.filter((im) => im.latitude != null && im.longitude != null);
  const semCoord = items.filter((im) => im.latitude == null || im.longitude == null);
  if (comCoord.length === 0) return items;
  const visited = new Set<string>();
  const result: ImovelResumo[] = [];
  let curLat = origemLat;
  let curLng = origemLng;
  while (result.length < comCoord.length) {
    let nearest: ImovelResumo | null = null;
    let minDist = Infinity;
    for (const im of comCoord) {
      if (visited.has(im.id)) continue;
      const d = haversineKm(curLat, curLng, im.latitude!, im.longitude!);
      if (d < minDist) { minDist = d; nearest = im; }
    }
    if (!nearest) break;
    visited.add(nearest.id);
    result.push(nearest);
    curLat = nearest.latitude!;
    curLng = nearest.longitude!;
  }
  return [...result, ...semCoord];
}

// ─── Subcomponents ────────────────────────────────────────────────────────────

function MetricCard({
  value, label, colorClass, urgent,
}: { value: number; label: string; colorClass: string; urgent?: boolean }) {
  return (
    <div className={cn('rounded-lg p-3 text-center', colorClass)}>
      {urgent && value > 0 && (
        <span className="block w-1.5 h-1.5 rounded-full bg-current mx-auto mb-1 animate-pulse" />
      )}
      <p className="text-2xl font-bold leading-none">{value}</p>
      <p className="text-[11px] font-medium mt-1 opacity-80 leading-tight">{label}</p>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AgenteHoje() {
  const navigate = useNavigate();
  const { clienteId, clienteAtivo } = useClienteAtivo();
  const { usuario } = useAuth();
  const isOffline = useOfflineStatus();
  const { pendingCount, failedCount, refreshCount } = useOfflineQueue();
  const [showSyncPanel, setShowSyncPanel] = useState(false);

  const [tab, setTab] = useState<'lista' | 'mapa'>('lista');
  const [listFiltro, setListFiltro] = useState<ListFiltro>('todos');
  const [busca, setBusca] = useState('');
  const [fichaImovel, setFichaImovel] = useState<ImovelResumo | null>(null);
  const [mapEverActivated, setMapEverActivated] = useState(false);
  const [mapFiltro, setMapFiltro] = useState<StatusKey | 'todos'>('todos');
  const [mapEl, setMapEl] = useState<L.Map | null>(null);
  const [rotaOrdem, setRotaOrdem] = useState<string[] | null>(null);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<L.CircleMarker[]>([]);

  const agenteId = usuario?.id ?? null;
  const { data: imoveis = [], isLoading } = useImoveisResumo(clienteId);
  const { data: alertasRetorno = [] } = useAlertasRetorno(clienteId, agenteId);
  const { data: focosAtribuidos } = useFocosAtribuidos(clienteId, agenteId);
  const { data: reinspecoesPendentes = [] } = useReinspecoesPendentesAgente(clienteId, agenteId);
  const hoje = new Date().toISOString().slice(0, 10);

  // ── Retorno alerts ──────────────────────────────────────────────────────────

  const alertasVencidos = useMemo(
    () => alertasRetorno.filter((a) => new Date(a.retorno_em) <= new Date()),
    [alertasRetorno],
  );

  const alertasRetornoIds = useMemo(
    () => new Set(alertasVencidos.map((a) => a.imovel_id)),
    [alertasVencidos],
  );

  // Retornos que ainda precisam de ação hoje — exclui imóveis já visitados neste dia.
  // Usado nos contadores de KPI e chip badge para manter consistência com o filtro da lista.
  const alertasRetornoPendentesCount = useMemo(() => {
    const visitadosHoje = new Set(
      imoveis.filter((im) => im.ultima_visita?.slice(0, 10) === hoje).map((im) => im.id),
    );
    return alertasVencidos.filter((a) => !visitadosHoje.has(a.imovel_id)).length;
  }, [alertasVencidos, imoveis, hoje]);

  // ── Derived counts ──────────────────────────────────────────────────────────

  const focosPendentesCount = useMemo(
    () => imoveis.filter((im) => im.focos_ativos > 0).length,
    [imoveis],
  );

  const imoveisPendentesCount = useMemo(
    () => imoveis.filter((im) => {
      const s = resolveStatusImovel(im, hoje);
      return s === 'pendente' || s === 'revisita';
    }).length,
    [imoveis, hoje],
  );

  const visitadosHojeCount = useMemo(
    () => imoveis.filter((im) => im.ultima_visita?.slice(0, 10) === hoje).length,
    [imoveis, hoje],
  );

  const revisitasCount = useMemo(
    () => imoveis.filter((im) => resolveStatusImovel(im, hoje) === 'revisita').length,
    [imoveis, hoje],
  );

  const pct = imoveis.length > 0
    ? Math.round((visitadosHojeCount / imoveis.length) * 100)
    : 0;

  // ── List: sorted base (priority order) ─────────────────────────────────────

  const imoveisOrdenados = useMemo(() => {
    const filtered = imoveis.filter((im) => {
      if (!busca) return true;
      const q = busca.toLowerCase();
      return (
        (im.logradouro ?? '').toLowerCase().includes(q) ||
        (im.bairro ?? '').toLowerCase().includes(q)
      );
    });

    return [...filtered].sort((a, b) => {
      const retornoA = alertasRetornoIds.has(a.id) ? 0 : 1;
      const retornoB = alertasRetornoIds.has(b.id) ? 0 : 1;
      if (retornoA !== retornoB) return retornoA - retornoB;

      const prioA = a.focos_ativos > 0 ? 0
        : resolveStatusImovel(a, hoje) === 'revisita' ? 1
        : resolveStatusImovel(a, hoje) === 'pendente' ? 2
        : 3;
      const prioB = b.focos_ativos > 0 ? 0
        : resolveStatusImovel(b, hoje) === 'revisita' ? 1
        : resolveStatusImovel(b, hoje) === 'pendente' ? 2
        : 3;
      if (prioA !== prioB) return prioA - prioB;
      return (b.score_territorial ?? -1) - (a.score_territorial ?? -1);
    });
  }, [imoveis, busca, hoje, alertasRetornoIds]);

  // ── List: apply filter chip ─────────────────────────────────────────────────

  const imoveisFiltradosOrdenados = useMemo(() => {
    if (listFiltro === 'todos') return imoveisOrdenados;
    if (listFiltro === 'retorno') return imoveisOrdenados.filter(
      (im) => alertasRetornoIds.has(im.id) && resolveStatusImovel(im, hoje) !== 'visitado',
    );
    if (listFiltro === 'pendente') return imoveisOrdenados.filter((im) => {
      const s = resolveStatusImovel(im, hoje);
      return s === 'pendente' || s === 'revisita';
    });
    if (listFiltro === 'visitado') return imoveisOrdenados.filter((im) => resolveStatusImovel(im, hoje) === 'visitado');
    return imoveisOrdenados;
  }, [imoveisOrdenados, listFiltro, alertasRetornoIds, hoje]);

  // ── Rota otimizada: aplica ordem do nearest-neighbor quando ativa ───────────

  const imoveisParaExibir = useMemo(() => {
    if (!rotaOrdem) return imoveisFiltradosOrdenados;
    const idx = new Map(rotaOrdem.map((id, i) => [id, i]));
    return [...imoveisFiltradosOrdenados].sort(
      (a, b) => (idx.get(a.id) ?? 9999) - (idx.get(b.id) ?? 9999),
    );
  }, [imoveisFiltradosOrdenados, rotaOrdem]);

  const handleOtimizarRota = useCallback(() => {
    const pendentes = imoveisFiltradosOrdenados.filter(
      (im) => resolveStatusImovel(im, hoje) !== 'visitado',
    );
    if (pendentes.length < 2) {
      toast.info('São necessários pelo menos 2 imóveis pendentes para otimizar a rota.');
      return;
    }
    const aplicar = (lat: number, lng: number) => {
      const ordenados = nearestNeighborImoveis(pendentes, lat, lng);
      setRotaOrdem(ordenados.map((im) => im.id));
      logEvento('rota_otimizada', clienteId, { imoveis_count: ordenados.length });
      toast.success(`Rota otimizada: ${ordenados.length} imóveis ordenados por proximidade.`);
    };
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => aplicar(pos.coords.latitude, pos.coords.longitude),
        () => {
          const first = pendentes.find((im) => im.latitude != null && im.longitude != null);
          if (first) {
            aplicar(first.latitude!, first.longitude!);
          } else {
            toast.error('GPS indisponível e nenhum imóvel com coordenadas.');
          }
        },
        { timeout: 5000 },
      );
    } else {
      const first = pendentes.find((im) => im.latitude != null && im.longitude != null);
      if (first) aplicar(first.latitude!, first.longitude!);
    }
  }, [imoveisFiltradosOrdenados, hoje]);

  // ── Próxima ação ────────────────────────────────────────────────────────────

  const proximaAcao = useMemo(() => {
    // Retorno urgente: só imóveis NÃO visitados hoje
    const retorno = imoveisOrdenados.find(
      (im) => alertasRetornoIds.has(im.id) && resolveStatusImovel(im, hoje) !== 'visitado',
    );
    if (retorno) return { imovel: retorno, tipo: 'retorno' as const };
    // Focos ativos: só imóveis não visitados hoje
    const foco = imoveisOrdenados.find(
      (im) => im.focos_ativos > 0 && resolveStatusImovel(im, hoje) !== 'visitado',
    );
    if (foco) return { imovel: foco, tipo: 'foco' as const };
    // Pendentes normais
    const pendente = imoveisOrdenados.find(
      (im) => resolveStatusImovel(im, hoje) !== 'visitado',
    );
    if (pendente) return { imovel: pendente, tipo: 'normal' as const };
    return null;
  }, [imoveisOrdenados, alertasRetornoIds, hoje]);

  // ── Map: init on first activation ──────────────────────────────────────────

  useEffect(() => {
    if (!mapEverActivated || !mapContainerRef.current || mapEl) return;

    const center: L.LatLngExpression = [
      clienteAtivo?.latitude_centro ?? -15.77,
      clienteAtivo?.longitude_centro ?? -47.92,
    ];
    const map = L.map(mapContainerRef.current, { center, zoom: 14, zoomControl: false });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 19,
    }).addTo(map);

    L.control.zoom({ position: 'topright' }).addTo(map);
    setMapEl(map);

    return () => {
      map.remove();
      setMapEl(null);
      markersRef.current = [];
    };
  }, [mapEverActivated, clienteAtivo?.latitude_centro, clienteAtivo?.longitude_centro]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (tab === 'mapa' && mapEl) {
      const timeout = setTimeout(() => mapEl.invalidateSize(), 80);
      return () => clearTimeout(timeout);
    }
  }, [tab, mapEl]);

  // ── Map: render markers ─────────────────────────────────────────────────────

  useEffect(() => {
    if (!mapEl) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const withCoords = imoveis.filter(
      (im) => im.latitude != null && im.longitude != null,
    );

    const filtered = mapFiltro === 'todos'
      ? withCoords
      : withCoords.filter((im) => resolveStatusImovel(im, hoje) === mapFiltro);

    for (const im of filtered) {
      const statusKey = resolveStatusImovel(im, hoje);
      const mapColor = STATUS_CONFIG[statusKey].mapColor;
      const isRetorno = alertasRetornoIds.has(im.id);
      const radius = im.focos_ativos > 0 ? 10 : isRetorno ? 9 : 7;

      const marker = L.circleMarker([im.latitude!, im.longitude!], {
        radius,
        fillColor: isRetorno ? '#f59e0b' : mapColor,
        color: isRetorno ? '#d97706' : '#ffffff',
        weight: isRetorno ? 2.5 : 2,
        opacity: 1,
        fillOpacity: 0.88,
      }).addTo(mapEl);

      marker.on('click', () => setFichaImovel(im));
      markersRef.current.push(marker);
    }

    if (filtered.length > 0) {
      const first = filtered.find((im) => im.focos_ativos > 0) ?? filtered[0];
      mapEl.setView([first.latitude!, first.longitude!], 15, { animate: true });
    }
  }, [mapEl, imoveis, mapFiltro, hoje, alertasRetornoIds]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  function handleTabChange(newTab: 'lista' | 'mapa') {
    setTab(newTab);
    if (newTab === 'mapa' && !mapEverActivated) setMapEverActivated(true);
  }

  function handleIniciarVistoria(id: string) {
    setFichaImovel(null);
    navigate(`/agente/vistoria/${id}`);
  }

  function handleSemAcesso(id: string) {
    setFichaImovel(null);
    navigate(`/agente/vistoria/${id}?modo=sem-acesso`);
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const filterChips: { key: ListFiltro; label: string; badge?: number }[] = [
    { key: 'todos',       label: 'Todos' },
    { key: 'atribuido',   label: 'Atribuídos',  badge: focosAtribuidos.length > 0 ? focosAtribuidos.length : undefined },
    { key: 'pendente',    label: 'Pendentes',   badge: imoveisPendentesCount > 0 ? imoveisPendentesCount : undefined },
    { key: 'retorno',     label: 'Retorno',     badge: alertasRetornoPendentesCount > 0 ? alertasRetornoPendentesCount : undefined },
    { key: 'reinspecao',  label: 'Reinspeções', badge: reinspecoesPendentes.length > 0 ? reinspecoesPendentes.length : undefined },
    { key: 'visitado',    label: 'Visitados',   badge: visitadosHojeCount > 0 ? visitadosHojeCount : undefined },
  ];

  return (
    <div className="flex flex-col h-full">

      {/* ── Header ── */}
      <div className="shrink-0 px-4 pt-4 pb-3 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="text-xl font-black text-foreground">Meu Dia</h1>
            <p className="text-sm text-muted-foreground">
              Olá, {usuario?.nome ?? usuario?.email?.split('@')[0] ?? 'Agente'} —{' '}
              {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {rotaOrdem ? (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs h-8 border-violet-400 text-violet-700 dark:text-violet-400"
                onClick={() => { setRotaOrdem(null); logEvento('rota_revertida', clienteId); }}
              >
                <Route className="w-3.5 h-3.5" />
                Rota ativa
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs h-8"
                onClick={handleOtimizarRota}
              >
                <Route className="w-3.5 h-3.5" />
                Otimizar rota
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-xs h-8"
              onClick={() => navigate('/agente/mapa')}
            >
              <Navigation className="w-3.5 h-3.5" />
              Mapa
            </Button>
            <CicloBadge compact />
          </div>
        </div>

        {/* Sync / offline status */}
        {(isOffline || pendingCount > 0 || failedCount > 0) && (
          <div className={cn(
            'rounded-xl border overflow-hidden',
            isOffline
              ? 'bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-700'
              : failedCount > 0
                ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700/50'
                : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700/50',
          )}>
            <div className="flex items-center gap-2 px-3 py-2.5">
              <WifiOff className={cn('w-4 h-4 shrink-0', isOffline ? 'text-amber-600' : failedCount > 0 ? 'text-red-500' : 'text-blue-500')} />
              <div className="flex-1 min-w-0">
                <p className={cn('text-xs font-semibold', isOffline ? 'text-amber-800 dark:text-amber-300' : failedCount > 0 ? 'text-red-700 dark:text-red-300' : 'text-blue-700 dark:text-blue-300')}>
                  {isOffline ? 'Sem conexão — modo offline' : 'Sincronização pendente'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {pendingCount > 0 && `${pendingCount} pendente${pendingCount > 1 ? 's' : ''}`}
                  {pendingCount > 0 && failedCount > 0 && ' · '}
                  {failedCount > 0 && `${failedCount} com falha`}
                </p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs gap-1 shrink-0"
                onClick={() => setShowSyncPanel((v) => !v)}
              >
                {showSyncPanel ? 'Ocultar' : 'Ver detalhes'}
              </Button>
            </div>
            {showSyncPanel && (
              <div className="border-t px-3 py-3 bg-background/60">
                <SyncStatusPanel onRefresh={refreshCount} />
              </div>
            )}
          </div>
        )}

        {/* Tab switcher */}
        <div className="flex rounded-xl bg-muted p-1 gap-1">
          <button
            onClick={() => handleTabChange('lista')}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold transition-all',
              tab === 'lista'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground',
            )}
          >
            <List className="w-4 h-4" />
            Lista
          </button>
          <button
            onClick={() => handleTabChange('mapa')}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold transition-all',
              tab === 'mapa'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground',
            )}
          >
            <MapIcon className="w-4 h-4" />
            Mapa
          </button>
        </div>
      </div>

      {/* ── LISTA TAB ── */}
      <div
        className={cn(
          'flex-1 overflow-y-auto px-4 space-y-3 pb-24',
          tab !== 'lista' && 'hidden',
        )}
      >
        {/* ── Próxima ação recomendada ── */}
        {proximaAcao && (
          <Card className={cn(
            'rounded-xl border-2',
            proximaAcao.tipo === 'retorno'
              ? 'border-amber-400 bg-amber-50/50 dark:bg-amber-900/10'
              : proximaAcao.tipo === 'foco'
              ? 'border-red-400 bg-red-50/50 dark:bg-red-900/10'
              : 'border-primary/40',
          )}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <div className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                    proximaAcao.tipo === 'retorno'
                      ? 'bg-amber-100 dark:bg-amber-900/30'
                      : proximaAcao.tipo === 'foco'
                      ? 'bg-red-100 dark:bg-red-900/30'
                      : 'bg-primary/10',
                  )}>
                    {proximaAcao.tipo === 'retorno'
                      ? <RotateCcw className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                      : proximaAcao.tipo === 'foco'
                      ? <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                      : <Navigation className="w-4 h-4 text-primary" />
                    }
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      {proximaAcao.tipo === 'retorno' ? 'Retorno urgente' : proximaAcao.tipo === 'foco' ? 'Foco ativo' : 'Próxima visita'}
                    </p>
                    <p className="text-sm font-bold text-foreground truncate leading-tight">
                      {proximaAcao.imovel.logradouro ?? 'Endereço não informado'}
                      {proximaAcao.imovel.numero ? `, ${proximaAcao.imovel.numero}` : ''}
                    </p>
                    <p className="text-xs text-muted-foreground">{proximaAcao.imovel.bairro ?? '—'}</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  className={cn(
                    'h-9 px-3 font-bold text-xs shrink-0',
                    proximaAcao.tipo === 'retorno' ? 'bg-amber-500 hover:bg-amber-600 text-white' : '',
                  )}
                  variant={proximaAcao.tipo === 'retorno' ? 'default' : 'default'}
                  onClick={() => handleIniciarVistoria(proximaAcao.imovel.id)}
                >
                  Iniciar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Progress ── */}
        <Card className="rounded-xl border border-border/60">
          <CardContent className="pt-4 pb-4 space-y-2">
            <div className="flex justify-between items-center text-sm">
              <span className="font-semibold text-foreground">Progresso do dia</span>
              <span className="text-muted-foreground">
                {visitadosHojeCount} visitados
                {revisitasCount > 0 && <span className="text-amber-600 dark:text-amber-400"> · {revisitasCount} revisita{revisitasCount > 1 ? 's' : ''}</span>}
                {' '}/ {imoveis.length} total
              </span>
            </div>
            <div className="h-2.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground text-right">{pct}% concluído</p>
          </CardContent>
        </Card>

        {/* ── Metric grid ── */}
        <div className="grid grid-cols-4 gap-2">
          <MetricCard
            value={focosPendentesCount}
            label="Focos"
            colorClass="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400"
            urgent
          />
          <MetricCard
            value={imoveisPendentesCount}
            label="Pendentes"
            colorClass="bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400"
          />
          <MetricCard
            value={alertasRetornoPendentesCount}
            label="Retorno"
            colorClass={alertasRetornoPendentesCount > 0
              ? 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400'
              : 'bg-gray-50 dark:bg-gray-800/30 text-gray-400'}
            urgent
          />
          <MetricCard
            value={visitadosHojeCount}
            label="Visitados"
            colorClass="bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400"
          />
        </div>

        {/* ── Filter chips ── */}
        <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
          {filterChips.map(({ key, label, badge }) => (
            <button
              key={key}
              type="button"
              onClick={() => setListFiltro(key)}
              className={cn(
                'relative flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold border transition-all whitespace-nowrap shrink-0',
                listFiltro === key
                  ? 'bg-foreground text-background border-transparent'
                  : 'bg-background text-foreground border-border',
              )}
            >
              {label}
              {badge != null && (
                <span className={cn(
                  'min-w-[18px] h-[18px] rounded-full px-1 text-[10px] font-bold flex items-center justify-center',
                  listFiltro === key
                    ? 'bg-background/20 text-background'
                    : key === 'retorno'
                    ? 'bg-amber-500 text-white'
                    : key === 'atribuido'
                    ? 'bg-blue-500 text-white'
                    : 'bg-muted text-muted-foreground',
                )}>
                  {badge > 99 ? '99+' : badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Search ── */}
        <Input
          placeholder="Buscar por rua ou bairro..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />

        {/* ── Banner: focos atribuídos aguardando (visível quando não está na aba Atribuídos) ── */}
        {listFiltro !== 'atribuido' && focosAtribuidos.length > 0 && (
          <button
            type="button"
            onClick={() => setListFiltro('atribuido')}
            className="w-full flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-left transition-colors hover:bg-blue-100 active:bg-blue-200"
          >
            <UserCheck className="w-5 h-5 text-blue-600 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-blue-800">
                {focosAtribuidos.length === 1
                  ? '1 foco atribuído requer sua atenção'
                  : `${focosAtribuidos.length} focos atribuídos requerem sua atenção`}
              </p>
              <p className="text-xs text-blue-600">Toque para ver os focos atribuídos a você</p>
            </div>
            <span className="text-blue-400 text-lg leading-none">›</span>
          </button>
        )}

        {/* ── Atribuídos a mim ── */}
        {listFiltro === 'atribuido' && (
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setListFiltro('todos')}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
            >
              <ChevronRight className="w-3.5 h-3.5 rotate-180" />
              Voltar à lista de imóveis
            </button>
            {focosAtribuidos.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center px-6">
                <UserCheck className="w-8 h-8 text-muted-foreground/40" />
                <p className="text-sm font-semibold text-foreground">Nenhum foco atribuído a você</p>
                <p className="text-xs text-muted-foreground">Quando um supervisor encaminhar um foco para você inspecionar, ele aparecerá aqui.</p>
              </div>
            ) : (
              focosAtribuidos.map((foco) => {
                const endereco = [foco.logradouro, foco.numero].filter(Boolean).join(', ') || 'Endereço não informado';
                const statusCfg = {
                  aguarda_inspecao: { border: 'border-l-blue-500',   icon: 'text-blue-600',   label: 'Aguarda inspeção',   btn: 'bg-blue-600 hover:bg-blue-700',     cta: 'Iniciar inspeção' },
                  em_inspecao:      { border: 'border-l-indigo-500', icon: 'text-indigo-600', label: 'Em inspeção',         btn: 'bg-indigo-600 hover:bg-indigo-700', cta: 'Retomar inspeção' },
                  confirmado:       { border: 'border-l-amber-500',  icon: 'text-amber-600',  label: 'Confirmado',          btn: 'bg-amber-600 hover:bg-amber-700',   cta: 'Iniciar tratamento' },
                  em_tratamento:    { border: 'border-l-purple-500', icon: 'text-purple-600', label: 'Em tratamento',       btn: 'bg-purple-600 hover:bg-purple-700', cta: 'Registrar resolução' },
                }[foco.status] ?? { border: 'border-l-gray-400', icon: 'text-gray-500', label: foco.status, btn: 'bg-gray-600 hover:bg-gray-700', cta: 'Ver detalhes' };
                return (
                  <Card
                    key={foco.id}
                    className={cn('rounded-xl border-l-4 border-border/60', statusCfg.border)}
                  >
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 mb-1">
                            <UserCheck className={cn('w-3.5 h-3.5 shrink-0', statusCfg.icon)} />
                            <span className={cn('text-[10px] font-bold uppercase tracking-wider', statusCfg.icon)}>
                              {statusCfg.label}
                            </span>
                          </div>
                          <p className="text-sm font-semibold text-foreground truncate">{endereco}</p>
                          <p className="text-xs text-muted-foreground">{foco.bairro ?? '—'}</p>
                          {foco.codigo_foco && (
                            <p className="text-[10px] font-mono text-muted-foreground/70 mt-0.5">{foco.codigo_foco}</p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          <PrioridadeBadge prioridade={foco.prioridade} />
                          <SlaBadge slaStatus={foco.sla_status} prazoEm={foco.sla_prazo_em} />
                        </div>
                      </div>
                      <Button
                        size="sm"
                        className={cn('w-full h-9 font-bold text-xs text-white', statusCfg.btn)}
                        onClick={() => navigate(`/agente/focos/${foco.id}`)}
                      >
                        {statusCfg.cta}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        )}

        {/* ── Reinspeções pendentes ── */}
        {listFiltro === 'reinspecao' && (
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setListFiltro('todos')}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
            >
              <ChevronRight className="w-3.5 h-3.5 rotate-180" />
              Voltar à lista de imóveis
            </button>
            {reinspecoesPendentes.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center px-6">
                <RotateCcw className="w-8 h-8 text-muted-foreground/40" />
                <p className="text-sm font-semibold text-foreground">Nenhuma reinspeção pendente</p>
                <p className="text-xs text-muted-foreground">Quando uma reinspeção for atribuída a você, ela aparecerá aqui.</p>
              </div>
            ) : (
              reinspecoesPendentes.map((r) => (
                <ReinspecaoCard
                  key={r.id}
                  reinspecao={r}
                  showFoco
                  onExecutar={() => navigate(`/agente/reinspecao/${r.id}`)}
                />
              ))
            )}
          </div>
        )}

        {/* ── List de imóveis (oculta quando filtro = atribuido ou reinspecao) ── */}
        {listFiltro !== 'atribuido' && listFiltro !== 'reinspecao' && isLoading && (
          <div className="space-y-3">
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
          </div>
        )}
        {listFiltro !== 'atribuido' && listFiltro !== 'reinspecao' && !isLoading && (
          <div className="space-y-2">
            {imoveisParaExibir.map((im) => {
              const statusKey = resolveStatusImovel(im, hoje);
              const cfg = STATUS_CONFIG[statusKey];
              const Icon = cfg.icon;
              const temFocoPendente = im.focos_ativos > 0;
              const temRecorrencia = im.focos_recorrentes > 0;
              const temRetorno = alertasRetornoIds.has(im.id);
              const scoreClass = im.score_classificacao
                ? SCORE_BADGE_CLASSES[im.score_classificacao]
                : null;

              return (
                <button
                  key={im.id}
                  className="w-full text-left"
                  onClick={() => setFichaImovel(im)}
                >
                  <Card className={cn(
                    'rounded-xl border transition-colors hover:bg-muted/20 border-border/60',
                    temRetorno && 'border-l-4 border-l-amber-400',
                  )}>
                    <CardContent className="p-4 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0', cfg.color)}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">
                            {im.logradouro ?? 'Endereço não informado'}{im.numero ? `, ${im.numero}` : ''}
                          </p>
                          <p className="text-xs text-muted-foreground">{im.bairro ?? '—'}</p>
                          {temRetorno && (
                            <p className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1">
                              <RotateCcw className="w-3 h-3" /> Retorno urgente
                            </p>
                          )}
                          {!temRetorno && temRecorrencia && (
                            <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                              {im.focos_recorrentes} foco(s) recorrente(s)
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {temFocoPendente && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-900/30 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:text-red-400 animate-pulse">
                            <AlertCircle className="w-3 h-3" /> Foco
                          </span>
                        )}
                        {scoreClass && im.score_territorial != null && (
                          <span className={cn('rounded-full px-2 py-0.5 text-[10px]', scoreClass)}>
                            {im.score_territorial}
                          </span>
                        )}
                        <Badge variant="outline" className={cn('text-[10px] font-semibold', cfg.color)}>
                          {cfg.label}
                        </Badge>
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </CardContent>
                  </Card>
                </button>
              );
            })}
            {imoveisFiltradosOrdenados.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-10 text-center px-6">
                {imoveis.length === 0 ? (
                  <>
                    <p className="text-sm font-semibold text-foreground">Nenhum imóvel no ciclo atual</p>
                    <p className="text-xs text-muted-foreground">Aguarde a distribuição de quarteirões pelo supervisor ou acesse a lista para cadastrar um imóvel.</p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-semibold text-foreground">Nenhum imóvel neste filtro</p>
                    <p className="text-xs text-muted-foreground">Tente o filtro "Todos" para ver a lista completa.</p>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── MAPA TAB ── */}
      <div
        className={cn(
          'flex-1 relative flex flex-col min-h-0',
          tab !== 'mapa' && 'hidden',
        )}
      >
        {/* Legend bar */}
        <div className="shrink-0 flex items-center gap-3 px-4 py-2 border-b bg-card text-xs overflow-x-auto scrollbar-none">
          {MAP_LEGEND.map(([key, cfg]) => (
            <div key={key} className="flex items-center gap-1.5 shrink-0">
              <span
                className="w-2.5 h-2.5 rounded-full border border-white shadow-sm"
                style={{ background: cfg.mapColor }}
              />
              <span className="text-muted-foreground font-medium whitespace-nowrap">{cfg.label}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="w-2.5 h-2.5 rounded-full border-2 border-amber-600 shadow-sm" style={{ background: '#f59e0b' }} />
            <span className="text-muted-foreground font-medium whitespace-nowrap">Retorno</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="w-3.5 h-3.5 rounded-full border border-white shadow-sm bg-red-400 flex items-center justify-center">
              <span className="text-white text-[7px] font-bold">!</span>
            </span>
            <span className="text-muted-foreground font-medium whitespace-nowrap">Foco ativo</span>
          </div>
        </div>

        {/* Map */}
        <div className="flex-1 relative min-h-0">
          <div ref={mapContainerRef} className="w-full h-full" />

          {/* Filter chips overlay */}
          <div className="absolute top-3 left-3 right-3 z-[1000] flex flex-wrap gap-1.5">
            {(['todos', 'pendente', 'revisita', 'visitado'] as const).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setMapFiltro(key)}
                className={cn(
                  'rounded-full px-3 py-1.5 text-xs font-semibold shadow-md border transition-all',
                  mapFiltro === key
                    ? 'bg-foreground text-background border-transparent'
                    : 'bg-background/90 backdrop-blur text-foreground border-border',
                )}
              >
                {key === 'todos' ? 'Todos' : STATUS_CONFIG[key].label}
              </button>
            ))}
          </div>
        </div>

        {/* Progress bar at bottom */}
        <div className="shrink-0 bg-background border-t px-4 py-3 space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="font-bold text-foreground">
              Visitas: {visitadosHojeCount} / {imoveis.length}
            </span>
            <span className="text-xs text-muted-foreground">{pct}%</span>
          </div>
          <div className="h-2.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>

      {/* ── Ficha do Imóvel ── */}
      <FichaImovel
        imovel={fichaImovel}
        hoje={hoje}
        onClose={() => setFichaImovel(null)}
        onIniciarVistoria={handleIniciarVistoria}
        onSemAcesso={handleSemAcesso}
      />
    </div>
  );
}
