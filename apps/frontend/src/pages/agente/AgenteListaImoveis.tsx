import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useClienteAtivo } from '@/hooks/useClienteAtivo';
import { useAuth } from '@/hooks/useAuth';
import { useCreateImovelMutation } from '@/hooks/queries/useImoveis';
import { useImoveisTerritorio } from '@/hooks/queries/useImoveisTerritorio';
import { useTerritorioAgente } from '@/hooks/queries/useTerritorioAgente';
import { api } from '@/services/api';
import { getCurrentCiclo } from '@/lib/ciclo';
import { useVistorias } from '@/hooks/queries/useVistorias';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeft,
  Plus,
  Search,
  MapPin,
  Home,
  Building2,
  Layers,
  List,
  Map as MapIcon,
  LocateFixed,
  AlertTriangle,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { TipoAtividade, TipoImovel, Imovel } from '@/types/database';
import { MapContainer, TileLayer, CircleMarker, Popup, Tooltip, GeoJSON } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

const ATIVIDADE_LABEL: Record<TipoAtividade, string> = {
  tratamento: 'Tratamento',
  pesquisa: 'Pesquisa',
  liraa: 'LIRAa',
  ponto_estrategico: 'Ponto Estratégico',
};

const STATUS_BORDER: Record<string, string> = {
  pendente: 'border-l-4 border-red-500',
  revisita: 'border-l-4 border-amber-500',
  visitado: 'border-l-4 border-green-500',
  fechado: 'border-l-4 border-gray-400',
  none: 'border-l-4 border-red-500',
};

const STATUS_BADGE_VARIANT: Record<string, 'destructive' | 'secondary' | 'outline' | 'default'> = {
  pendente: 'destructive',
  revisita: 'default',
  visitado: 'secondary',
  fechado: 'outline',
  none: 'destructive',
};

const STATUS_LABEL: Record<string, string> = {
  pendente: 'Pendente',
  revisita: 'Revisita',
  visitado: 'Visitado',
  fechado: 'Fechado',
  none: 'Nunca visitado',
};

const STATUS_VISUAL: Record<string, { label: string; leftBorder: string; badgeClass: string }> = {
  pendente: { label: 'Pendente',       leftBorder: 'border-l-red-500',   badgeClass: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  revisita: { label: 'Revisita',       leftBorder: 'border-l-amber-500', badgeClass: 'bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400' },
  visitado: { label: 'Visitado',       leftBorder: 'border-l-green-500', badgeClass: 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400' },
  fechado:  { label: 'Fechado',        leftBorder: 'border-l-gray-400',  badgeClass: 'bg-gray-100 text-gray-500 dark:bg-gray-800/50 dark:text-gray-400' },
  none:     { label: 'Nunca visitado', leftBorder: 'border-l-red-400',   badgeClass: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
};

const TIPO_IMOVEL_OPTIONS: { value: TipoImovel; label: string }[] = [
  { value: 'residencial', label: 'Residencial' },
  { value: 'comercial', label: 'Comercial' },
  { value: 'terreno', label: 'Terreno' },
  { value: 'ponto_estrategico', label: 'Ponto Estratégico' },
];

interface NovoImovelForm {
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  regiaoId: string | null;
  quadraId: string | null;
  quarteirao: string;
  tipo_imovel: TipoImovel;
  latitude: number | null;
  longitude: number | null;
}

const EMPTY_FORM: NovoImovelForm = {
  logradouro: '',
  numero: '',
  complemento: '',
  bairro: '',
  regiaoId: null,
  quadraId: null,
  quarteirao: '',
  tipo_imovel: 'residencial',
  latitude: null,
  longitude: null,
};

export default function AgenteListaImoveis() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const atividade = (searchParams.get('atividade') as TipoAtividade) || 'pesquisa';
  const atividadeExplicita = searchParams.get('atividade') !== null;

  const { clienteId, clienteAtivo } = useClienteAtivo();
  const { usuario } = useAuth();
  const usuarioId = usuario?.id ?? null;

  // Ciclo calculado no render para não ficar stale se app cruzar virada de ciclo
  const currentCiclo = useMemo(() => getCurrentCiclo(), []);

  const [search, setSearch] = useState('');
  const [filtroBairro, setFiltroBairro] = useState<string>('__all__');
  const [viewMode, setViewMode] = useState<'lista' | 'mapa'>('lista');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<NovoImovelForm>(EMPTY_FORM);
  const [dedupWarning, setDedupWarning] = useState<string | null>(null);
  const [checkingDedup, setCheckingDedup] = useState(false);
  const dedupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // C-05: captura GPS automaticamente ao abrir o dialog de cadastro
  useEffect(() => {
    if (!dialogOpen) return;
    if (!('geolocation' in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((prev) => ({
          ...prev,
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        }));
      },
      () => { /* GPS negado ou indisponível — silent fail */ },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 },
    );
  }, [dialogOpen]);

  const { data: territorio, isLoading: loadingTerritorio } = useTerritorioAgente();
  const { data: imoveis = [], isLoading: loadingImoveis } = useImoveisTerritorio();
  const { data: vistorias = [], isLoading: loadingVistorias } = useVistorias(
    clienteId,
    usuarioId,
    currentCiclo,
  );

  const createImovelMutation = useCreateImovelMutation();

  // Map imovelId → latest vistoria status
  const statusPorImovel = useMemo(() => {
    const map = new Map<string, string>();
    const sorted = [...vistorias].sort(
      (a, b) => new Date((b as any).dataVisita ?? (b as any).data_visita).getTime()
              - new Date((a as any).dataVisita ?? (a as any).data_visita).getTime(),
    );
    for (const v of sorted) {
      const id = (v as any).imovelId ?? (v as any).imovel_id;
      if (id && !map.has(id)) map.set(id, v.status);
    }
    return map;
  }, [vistorias]);

  // Map imovelId → tem pendência de evidência (assinatura ou foto)
  const pendenciasPorImovel = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const v of vistorias) {
      const id = (v as any).imovelId ?? (v as any).imovel_id;
      const pend = (v as any).pendenteAssinatura ?? (v as any).pendente_assinatura;
      const foto = (v as any).pendenteFoto ?? (v as any).pendente_foto;
      if (id && (pend || foto)) map.set(id, true);
    }
    return map;
  }, [vistorias]);

  // Map imovelId → latest dataVisita
  const ultimaVisitaPorImovel = useMemo(() => {
    const map = new Map<string, string>();
    const sorted = [...vistorias].sort(
      (a, b) => new Date((b as any).dataVisita ?? (b as any).data_visita).getTime()
              - new Date((a as any).dataVisita ?? (a as any).data_visita).getTime(),
    );
    for (const v of sorted) {
      const id = (v as any).imovelId ?? (v as any).imovel_id;
      const data = (v as any).dataVisita ?? (v as any).data_visita;
      if (id && data && !map.has(id)) map.set(id, data);
    }
    return map;
  }, [vistorias]);

  const bairrosDistintos = useMemo(() => {
    const set = new Set<string>();
    for (const im of imoveis) {
      if (im.bairro) set.add(im.bairro);
    }
    for (const q of territorio?.quadras ?? []) {
      if (q.bairroNome) set.add(q.bairroNome);
    }
    return Array.from(set).sort();
  }, [imoveis, territorio]);

  // Bairros únicos do território atribuído ao agente (para o select do formulário)
  const bairrosDoTerritorio = useMemo(() => {
    if (!territorio?.quadras) return [];
    const map = new Map<string, string>();
    for (const q of territorio.quadras) {
      if (q.bairroId && q.bairroNome) map.set(q.bairroId, q.bairroNome);
    }
    return Array.from(map.entries())
      .map(([id, nome]) => ({ id, nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [territorio]);

  // Quarteirões do bairro selecionado no formulário
  const quarteiroesDoBairro = useMemo(() => {
    if (!territorio?.quadras || !form.regiaoId) return [];
    return territorio.quadras
      .filter((q) => q.bairroId === form.regiaoId)
      .sort((a, b) => a.codigo.localeCompare(b.codigo, undefined, { numeric: true }));
  }, [territorio, form.regiaoId]);

  const imoveisFiltrados = useMemo(() => {
    const q = search.toLowerCase();
    return imoveis.filter((im) => {
      const matchSearch =
        !q ||
        (im.logradouro?.toLowerCase().includes(q) ?? false) ||
        (im.bairro?.toLowerCase().includes(q) ?? false) ||
        (im.quarteirao?.toLowerCase().includes(q) ?? false);
      const matchBairro = filtroBairro === '__all__' || im.bairro === filtroBairro;
      return matchSearch && matchBairro;
    });
  }, [imoveis, search, filtroBairro]);

  const imoveisComCoordenadas = useMemo(
    () =>
      imoveisFiltrados.filter(
        (im) => typeof im.latitude === 'number' && typeof im.longitude === 'number',
      ),
    [imoveisFiltrados],
  );

  const mapaCenter = useMemo<[number, number]>(() => {
    if (imoveisComCoordenadas.length === 0) {
      if (
        typeof clienteAtivo?.latitude_centro === 'number' &&
        typeof clienteAtivo?.longitude_centro === 'number'
      ) {
        return [clienteAtivo.latitude_centro, clienteAtivo.longitude_centro];
      }
      return [-20.4697, -54.6201]; // fallback MS
    }
    const sum = imoveisComCoordenadas.reduce(
      (acc, im) => ({
        lat: acc.lat + (im.latitude as number),
        lng: acc.lng + (im.longitude as number),
      }),
      { lat: 0, lng: 0 },
    );
    return [sum.lat / imoveisComCoordenadas.length, sum.lng / imoveisComCoordenadas.length];
  }, [imoveisComCoordenadas, clienteAtivo?.latitude_centro, clienteAtivo?.longitude_centro]);

  function handleFormChange(field: keyof NovoImovelForm, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleBairroChange(bairroId: string) {
    const bairro = bairrosDoTerritorio.find((b) => b.id === bairroId);
    setForm((prev) => ({
      ...prev,
      regiaoId: bairroId,
      bairro: bairro?.nome ?? '',
      quadraId: null,
      quarteirao: '',
    }));
  }

  function handleQuarteiraoChange(quadraId: string) {
    const quadra = quarteiroesDoBairro.find((q) => q.quadraId === quadraId);
    setForm((prev) => ({ ...prev, quadraId, quarteirao: quadra?.codigo ?? '' }));
  }

  // Dedup de endereço: dispara 600ms após parar de digitar logradouro ou numero
  useEffect(() => {
    if (!form.logradouro.trim() || !form.numero.trim() || !clienteId) {
      setDedupWarning(null);
      return;
    }
    if (dedupTimerRef.current) clearTimeout(dedupTimerRef.current);
    dedupTimerRef.current = setTimeout(async () => {
      setCheckingDedup(true);
      try {
        const result = await api.imoveis.findByEndereco(clienteId, form.logradouro.trim(), form.numero.trim());
        setDedupWarning(
          result
            ? `Endereço já cadastrado: ${result.logradouro}, nº ${result.numero}${result.bairro ? ` — ${result.bairro}` : ''}`
            : null,
        );
      } catch {
        setDedupWarning(null);
      } finally {
        setCheckingDedup(false);
      }
    }, 600);
    return () => { if (dedupTimerRef.current) clearTimeout(dedupTimerRef.current); };
  }, [form.logradouro, form.numero, clienteId]);

  async function handleCreateImovel() {
    if (!clienteId) return;
    if (!form.logradouro.trim()) {
      toast.error('Logradouro é obrigatório.');
      return;
    }
    if (dedupWarning) {
      toast.error('Este endereço já está cadastrado no sistema.');
      return;
    }
    try {
      await createImovelMutation.mutateAsync({
        ...form,
        regiaoId: form.regiaoId ?? undefined,
        quadraId: form.quadraId ?? undefined,
        cliente_id: clienteId,
        ativo: true,
      } as Omit<Imovel, 'id' | 'created_at' | 'updated_at'>);
      toast.success('Imóvel cadastrado com sucesso.');
      setDialogOpen(false);
      setForm(EMPTY_FORM);
      setDedupWarning(null);
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message ?? '';
      if (msg.includes('quarteirão') || msg.includes('território')) {
        toast.error('Você não está atribuído a este quarteirão.');
      } else {
        toast.error('Erro ao cadastrar imóvel. Tente novamente.');
      }
    }
  }

  const isLoading = loadingTerritorio || loadingImoveis || loadingVistorias;

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0"
          onClick={() => navigate('/agente/hoje')}
          aria-label="Voltar"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="font-semibold text-base leading-tight truncate">Imóveis</h1>
          <p className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap">
            {isLoading ? 'Carregando…' : `${imoveisFiltrados.length} imóvel(is)`}
            {atividadeExplicita && (
              <span className="inline-flex items-center rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                {ATIVIDADE_LABEL[atividade] ?? atividade}
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="bg-white border-b px-4 py-3 space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar logradouro, bairro, quarteirão…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-10 text-sm"
          />
        </div>
        <div className="flex gap-2 items-center">
          {!loadingTerritorio && (!territorio || territorio.quadras.length === 0) ? (
            <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-2 flex-1 min-w-0">
              <AlertTriangle className="w-3 h-3 shrink-0" />
              <span className="truncate">Sem território atribuído</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-primary bg-primary/10 border border-primary/20 rounded-lg px-2.5 py-2 shrink-0">
              <Layers className="w-3 h-3 shrink-0" />
              <span>{territorio?.quadras.length ?? 0} quadras</span>
            </div>
          )}
          <Select value={filtroBairro} onValueChange={setFiltroBairro}>
            <SelectTrigger className="h-9 text-xs flex-1">
              <SelectValue placeholder="Todos os bairros" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos os bairros</SelectItem>
              {bairrosDistintos.map((b) => (
                <SelectItem key={b} value={b}>{b}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex border rounded-lg overflow-hidden shrink-0">
            <Button
              variant={viewMode === 'lista' ? 'default' : 'ghost'}
              size="sm"
              className="h-9 px-2.5 rounded-none"
              onClick={() => setViewMode('lista')}
              aria-label="Lista"
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'mapa' ? 'default' : 'ghost'}
              size="sm"
              className="h-9 px-2.5 rounded-none"
              onClick={() => setViewMode('mapa')}
              aria-label="Mapa"
            >
              <MapIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 pb-24">
        {viewMode === 'mapa' ? (
          <div className="relative h-[60vh] rounded-xl overflow-hidden border border-border isolate">
            <MapContainer center={mapaCenter} zoom={imoveisComCoordenadas.length > 0 ? 14 : 12} style={{ width: '100%', height: '100%' }}>
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {(territorio?.quadras ?? [])
                .filter((q) => q.geojson != null)
                .map((q) => {
                  const highlighted = filtroBairro === '__all__' || q.bairroNome === filtroBairro;
                  return (
                    <GeoJSON
                      key={`${q.quadraId}-${filtroBairro}`}
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      data={q.geojson as any}
                      style={{
                        color: highlighted ? '#2563eb' : '#94a3b8',
                        fillColor: highlighted ? '#3b82f6' : '#cbd5e1',
                        fillOpacity: highlighted ? 0.18 : 0.05,
                        weight: highlighted ? 2 : 1,
                      }}
                    />
                  );
                })}
              {imoveisComCoordenadas.map((imovel) => {
                const status = statusPorImovel.get(imovel.id) ?? 'none';
                const bloqueado = status === 'visitado' || status === 'fechado';
                const color = status === 'visitado'
                  ? '#16a34a'
                  : status === 'fechado'
                  ? '#6b7280'
                  : status === 'revisita'
                  ? '#f59e0b'
                  : '#ef4444';
                return (
                  <CircleMarker
                    key={imovel.id}
                    center={[imovel.latitude as number, imovel.longitude as number]}
                    radius={8}
                    pathOptions={{ color, fillColor: color, fillOpacity: 0.9, weight: 2 }}
                  >
                    <Tooltip
                      direction="top"
                      offset={[0, -6]}
                      opacity={0.95}
                      className="!bg-background !text-foreground !border !border-border !shadow-lg"
                    >
                      <div className="space-y-0.5">
                        <p className="text-[11px] font-semibold">
                          {imovel.numero ? `${imovel.numero} — ` : ''}
                          {imovel.logradouro ?? 'Sem logradouro'}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {imovel.bairro || 'Sem bairro'}{imovel.quarteirao ? ` · Qt. ${imovel.quarteirao}` : ''}
                        </p>
                        <p className="text-[10px]">
                          Status: {STATUS_LABEL[status] ?? status}
                        </p>
                      </div>
                    </Tooltip>
                    <Popup>
                      <div className="space-y-1 min-w-[180px]">
                        <p className="font-semibold text-sm">
                          {imovel.numero ? `${imovel.numero} — ` : ''}
                          {imovel.logradouro ?? 'Sem logradouro'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {[imovel.bairro, imovel.quarteirao ? `Qt. ${imovel.quarteirao}` : null]
                            .filter(Boolean)
                            .join(' · ') || 'Sem localização'}
                        </p>
                        <p className="text-xs">Status: {STATUS_LABEL[status] ?? status}</p>
                        <Button
                          size="sm"
                          className="w-full h-8 text-xs"
                          onClick={() => {
                            if (bloqueado) {
                              toast.info('Este imóvel já foi finalizado neste ciclo.');
                              return;
                            }
                            navigate(`/agente/vistoria/${imovel.id}?atividade=${atividade}`);
                          }}
                        >
                          Abrir vistoria
                        </Button>
                      </div>
                    </Popup>
                  </CircleMarker>
                );
              })}
            </MapContainer>
            {imoveisComCoordenadas.length === 0 && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="bg-background/90 border border-border rounded-lg px-4 py-2 text-sm text-muted-foreground">
                  Mapa da cidade carregado. Cadastre latitude/longitude no imóvel para exibir marcador.
                </div>
              </div>
            )}
          </div>
        ) : isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-[68px] rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : imoveisFiltrados.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-2">
            <Home className="h-8 w-8 opacity-40" />
            <p className="text-sm font-medium">Nenhum imóvel encontrado.</p>
            <p className="text-xs opacity-70">Ajuste os filtros ou a busca.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {imoveisFiltrados.map((imovel) => {
              const status = statusPorImovel.get(imovel.id) ?? 'none';
              const ultimaVisita = ultimaVisitaPorImovel.get(imovel.id);
              const bloqueado = status === 'visitado' || status === 'fechado';
              const temPendencia = pendenciasPorImovel.get(imovel.id) ?? false;
              const visual = STATUS_VISUAL[status] ?? STATUS_VISUAL.none;

              return (
                <button
                  key={imovel.id}
                  className="w-full text-left"
                  onClick={() => {
                    if (bloqueado) {
                      toast.info('Este imóvel já foi finalizado neste ciclo.');
                      return;
                    }
                    navigate(`/agente/vistoria/${imovel.id}?atividade=${atividade}`);
                  }}
                >
                  <div className={cn(
                    'bg-card rounded-xl border border-border/60 border-l-4 transition-colors active:bg-muted/20',
                    visual.leftBorder,
                    bloqueado && 'opacity-60',
                  )}>
                    <div className="px-3.5 py-3 flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-sm leading-tight truncate">
                          {imovel.numero ? `${imovel.numero} — ` : ''}
                          {imovel.logradouro ?? 'Sem logradouro'}
                        </p>
                        <div className="flex items-center gap-1 mt-0.5">
                          <MapPin className="h-3 w-3 shrink-0 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground truncate">
                            {[imovel.bairro, imovel.quarteirao ? `Qt. ${imovel.quarteirao}` : null]
                              .filter(Boolean)
                              .join(' · ') || 'Sem localização'}
                          </span>
                        </div>
                        {ultimaVisita && (
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            Visitado {new Date(ultimaVisita).toLocaleDateString('pt-BR')}
                          </p>
                        )}
                        {temPendencia && (
                          <div className="flex items-center gap-1 mt-0.5 text-[11px] text-amber-600 font-semibold">
                            <AlertTriangle className="h-3 w-3" />
                            Evidência pendente
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold', visual.badgeClass)}>
                          {visual.label}
                        </span>
                        {!bloqueado && <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* FAB */}
      <Button
        size="icon"
        className="fixed right-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] lg:right-6 lg:bottom-6 h-14 w-14 rounded-full shadow-lg z-30"
        onClick={() => setDialogOpen(true)}
        aria-label="Cadastrar novo imóvel"
      >
        <Plus className="h-6 w-6" />
      </Button>

      {/* Create imovel dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Imóvel</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="bairro">Bairro *</Label>
                <Select
                  value={form.regiaoId ?? ''}
                  onValueChange={handleBairroChange}
                  disabled={bairrosDoTerritorio.length === 0}
                >
                  <SelectTrigger id="bairro">
                    <SelectValue placeholder={bairrosDoTerritorio.length === 0 ? 'Sem território' : 'Selecione'} />
                  </SelectTrigger>
                  <SelectContent>
                    {bairrosDoTerritorio.map((b) => (
                      <SelectItem key={b.id} value={b.id}>{b.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="quarteirao">Quarteirão *</Label>
                <Select
                  value={quarteiroesDoBairro.find((q) => q.codigo === form.quarteirao)?.quadraId ?? ''}
                  onValueChange={handleQuarteiraoChange}
                  disabled={!form.regiaoId || quarteiroesDoBairro.length === 0}
                >
                  <SelectTrigger id="quarteirao">
                    <SelectValue placeholder={!form.regiaoId ? 'Selecione o bairro' : 'Selecione'} />
                  </SelectTrigger>
                  <SelectContent>
                    {quarteiroesDoBairro.map((q) => (
                      <SelectItem key={q.quadraId} value={q.quadraId}>Qt. {q.codigo}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="logradouro">Logradouro *</Label>
              <Input
                id="logradouro"
                placeholder="Ex: Rua das Flores"
                value={form.logradouro}
                onChange={(e) => handleFormChange('logradouro', e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="numero">Número</Label>
                <Input
                  id="numero"
                  placeholder="Ex: 123"
                  value={form.numero}
                  onChange={(e) => handleFormChange('numero', e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="complemento">Complemento</Label>
                <Input
                  id="complemento"
                  placeholder="Ex: Apt 2"
                  value={form.complemento}
                  onChange={(e) => handleFormChange('complemento', e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="tipo_imovel">Tipo de imóvel</Label>
              <Select
                value={form.tipo_imovel}
                onValueChange={(v) => handleFormChange('tipo_imovel', v as TipoImovel)}
              >
                <SelectTrigger id="tipo_imovel">
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  {TIPO_IMOVEL_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* C-05: indicador de GPS — alerta se sem coordenadas */}
            {form.latitude != null ? (
              <div className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400">
                <LocateFixed className="w-3.5 h-3.5 shrink-0" />
                GPS capturado ({form.latitude.toFixed(5)}, {form.longitude?.toFixed(5)})
              </div>
            ) : (
              <div className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-700 dark:bg-amber-950/30 dark:border-amber-700 dark:text-amber-300">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                Sem GPS — o imóvel não aparecerá no mapa nem nos cruzamentos geoespaciais
              </div>
            )}

            {dedupWarning && (
              <div className="flex items-start gap-1.5 rounded-lg border border-destructive/40 bg-destructive/10 px-2.5 py-2 text-xs text-destructive">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>{dedupWarning}</span>
              </div>
            )}
            {checkingDedup && (
              <p className="text-xs text-muted-foreground">Verificando endereço…</p>
            )}

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setDialogOpen(false);
                  setForm(EMPTY_FORM);
                  setDedupWarning(null);
                }}
              >
                Cancelar
              </Button>
              <Button
                className="flex-1"
                onClick={handleCreateImovel}
                disabled={createImovelMutation.isPending || !!dedupWarning || checkingDedup}
              >
                {createImovelMutation.isPending ? 'Salvando…' : 'Salvar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
