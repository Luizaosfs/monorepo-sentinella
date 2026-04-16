import { useMemo, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Circle, Clock, Lock, XCircle } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useClienteAtivo } from '@/hooks/useClienteAtivo';
import { useAuth } from '@/hooks/useAuth';
import { useImoveis } from '@/hooks/queries/useImoveis';
import { useVistorias } from '@/hooks/queries/useVistorias';
import { useAlertasRetorno } from '@/hooks/queries/useAlertasRetorno';
import { useQuarteiroesByAgente } from '@/hooks/queries/useDistribuicaoQuarteirao';
import { ImovelRotaLayer, IMOVEL_STATUS_CONFIG } from '@/components/map-v3/ImovelRotaLayer';
import type { StatusVistoria, Imovel } from '@/types/database';
import { getCurrentCiclo } from '@/lib/ciclo';

type FiltroStatus = 'todos' | StatusVistoria | 'retorno';

export default function OperadorRotaDiaria() {
  const currentCiclo = getCurrentCiclo();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { clienteId, clienteAtivo } = useClienteAtivo();
  const { usuario } = useAuth();
  const agenteId = usuario?.id ?? null;

  const [mapEl, setMapEl] = useState<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>(
    (searchParams.get('filtro') as FiltroStatus) ?? 'todos'
  );

  // Data
  const { data: imoveis = [] } = useImoveis(clienteId);
  const { data: vistorias = [] } = useVistorias(clienteId, agenteId, currentCiclo);
  const { data: alertasRetorno = [] } = useAlertasRetorno(clienteId, agenteId);

  const { data: quarteiroes = [] } = useQuarteiroesByAgente(clienteId, agenteId, currentCiclo);

  // Status map
  const statusPorImovel = useMemo(() => {
    const map = new Map<string, StatusVistoria | 'none'>();
    const sorted = [...vistorias].sort(
      (a, b) => new Date(b.data_visita).getTime() - new Date(a.data_visita).getTime(),
    );
    for (const v of sorted) {
      if (!map.has(v.imovel_id)) map.set(v.imovel_id, v.status);
    }
    return map;
  }, [vistorias]);

  const alertasVencidos = useMemo(
    () => alertasRetorno.filter((a) => new Date(a.retorno_em) <= new Date()),
    [alertasRetorno],
  );

  const alertasRetornoIds = useMemo(
    () => new Set(alertasVencidos.map((a) => a.imovel_id)),
    [alertasVencidos],
  );

  // Progress
  const totalImoveis = imoveis.length;
  const visitadosCont = [...statusPorImovel.values()].filter(
    (s) => s === 'visitado' || s === 'fechado',
  ).length;

  // Filter chips logic
  const imoveisFiltrados = useMemo(() => {
    if (filtroStatus === 'todos') return imoveis;
    if (filtroStatus === 'retorno') return imoveis.filter((im) => alertasRetornoIds.has(im.id));
    return imoveis.filter((im) => {
      const s = statusPorImovel.get(im.id) ?? 'none';
      if (filtroStatus === 'pendente') return s === 'none' || s === 'pendente';
      return s === filtroStatus;
    });
  }, [imoveis, filtroStatus, statusPorImovel, alertasRetornoIds]);

  // Init Leaflet map
  useEffect(() => {
    if (!mapContainerRef.current || mapEl) return;

    // Default center: Brasil
    const center: L.LatLngExpression = [-15.77, -47.92];
    const map = L.map(mapContainerRef.current, {
      center,
      zoom: 14,
      zoomControl: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 19,
    }).addTo(map);

    L.control.zoom({ position: 'topright' }).addTo(map);

    setMapEl(map);

    return () => {
      map.remove();
      setMapEl(null);
    };
  }, []);

  // Center on cliente city when map loads (before imóveis arrive)
  useEffect(() => {
    if (!mapEl || !clienteAtivo?.latitude_centro || !clienteAtivo?.longitude_centro) return;
    mapEl.setView([clienteAtivo.latitude_centro, clienteAtivo.longitude_centro], 14, { animate: false });
  }, [mapEl, clienteAtivo?.latitude_centro, clienteAtivo?.longitude_centro]);

  // Pan to first imovel with GPS (takes priority over city center)
  useEffect(() => {
    if (!mapEl || imoveisFiltrados.length === 0) return;
    const first = imoveisFiltrados.find((im) => im.latitude != null && im.longitude != null);
    if (first) {
      mapEl.setView([first.latitude!, first.longitude!], 15, { animate: true });
    }
  }, [mapEl, imoveisFiltrados.length]);

  function handleImovelClick(im: Imovel) {
    const status = statusPorImovel.get(im.id) ?? 'none';
    if (status !== 'visitado' && status !== 'fechado') {
      navigate(`/agente/vistoria/${im.id}`);
    }
  }

  const filterChips: { key: FiltroStatus; label: string; icon: React.ReactNode; badge?: number }[] = [
    { key: 'todos',    label: 'Todos',    icon: null },
    { key: 'pendente', label: 'Pend.',    icon: <Circle className="w-3 h-3" /> },
    { key: 'revisita', label: 'Fechados', icon: <Lock className="w-3 h-3" /> },
    { key: 'recusa',   label: 'Recusa',   icon: <XCircle className="w-3 h-3" /> },
    { key: 'visitado', label: 'Tratados', icon: <CheckCircle2 className="w-3 h-3" /> },
    {
      key: 'retorno',
      label: 'Retorno',
      icon: <Clock className="w-3 h-3" />,
      badge: alertasVencidos.length > 0 ? alertasVencidos.length : undefined,
    },
  ];

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      {/* Header */}
      <div className="bg-card border-b px-4 py-3 flex items-center gap-3 sticky top-0 z-10 shrink-0">
        <Button variant="ghost" size="icon" className="shrink-0" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="font-semibold text-base leading-tight">Minha Rota Diária</h1>
          <p className="text-xs text-muted-foreground">
            Ciclo {currentCiclo} · {totalImoveis} imóveis
          </p>
        </div>
      </div>

      {/* Status legend pills */}
      <div className="flex items-center gap-2 px-4 py-2 border-b bg-card shrink-0 text-xs overflow-x-auto scrollbar-none">
        {Object.entries(IMOVEL_STATUS_CONFIG)
          .filter(([k]) => !['none', 'fechado'].includes(k))
          .map(([k, cfg]) => (
            <div key={k} className="flex items-center gap-1.5 shrink-0">
              <span className="w-2.5 h-2.5 rounded-full border border-white/80 shadow-sm" style={{ background: cfg.color }} />
              <span className="text-muted-foreground font-medium whitespace-nowrap">{cfg.label}</span>
            </div>
          ))}
      </div>

      {/* Map */}
      <div className="flex-1 relative min-h-0">
        <div ref={mapContainerRef} className="w-full h-full" />

        <ImovelRotaLayer
          map={mapEl}
          imoveis={imoveisFiltrados}
          statusPorImovel={statusPorImovel}
          quarteiroes={quarteiroes}
          alertasRetornoIds={alertasRetornoIds}
          onImovelClick={handleImovelClick}
        />

        {/* Filter chips overlay */}
        <div className="absolute top-3 left-3 right-3 z-[1000] flex flex-wrap gap-1.5">
          {filterChips.map(({ key, label, icon, badge }) => (
            <button
              key={key}
              type="button"
              onClick={() => setFiltroStatus(key)}
              className={cn(
                'relative flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold shadow-md border transition-all',
                filtroStatus === key
                  ? 'bg-foreground text-background border-transparent'
                  : 'bg-background/90 backdrop-blur text-foreground border-border',
              )}
            >
              {icon}
              {label}
              {badge != null && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center">
                  {badge > 9 ? '9+' : badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Progress card */}
      <div className="shrink-0 bg-background border-t">
        <Card className="rounded-none border-0 border-t border-border">
          <CardContent className="px-4 py-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-foreground">
                Visitas Concluídas: {visitadosCont} / {totalImoveis}
              </span>
              <span className="text-xs text-muted-foreground">
                {totalImoveis > 0 ? Math.round((visitadosCont / totalImoveis) * 100) : 0}%
              </span>
            </div>
            <div className="relative h-3 w-full bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-700"
                style={{ width: `${totalImoveis > 0 ? (visitadosCont / totalImoveis) * 100 : 0}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground font-semibold">
              <span>{visitadosCont} concluídos</span>
              <span>{totalImoveis - visitadosCont} pendentes</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
