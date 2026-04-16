import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useClienteAtivo } from '@/hooks/useClienteAtivo';
import { useAuth } from '@/hooks/useAuth';
import { useImoveis, useCreateImovelMutation } from '@/hooks/queries/useImoveis';
import { getCurrentCiclo } from '@/lib/ciclo';
import { useVistorias } from '@/hooks/queries/useVistorias';
import { useQuarteiroesByAgente } from '@/hooks/queries/useDistribuicaoQuarteirao';
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
} from 'lucide-react';
import { toast } from 'sonner';
import { TipoAtividade, TipoImovel, Imovel } from '@/types/database';
import { MapContainer, TileLayer, CircleMarker, Popup, Tooltip } from 'react-leaflet';
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

const TIPO_IMOVEL_OPTIONS: { value: TipoImovel; label: string }[] = [
  { value: 'residencial', label: 'Residencial' },
  { value: 'comercial', label: 'Comercial' },
  { value: 'terreno', label: 'Terreno' },
  { value: 'ponto_estrategico', label: 'Ponto Estratégico' },
];

const currentCiclo = getCurrentCiclo();

interface NovoImovelForm {
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
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
  quarteirao: '',
  tipo_imovel: 'residencial',
  latitude: null,
  longitude: null,
};

export default function OperadorListaImoveis() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const atividade = (searchParams.get('atividade') as TipoAtividade) || 'pesquisa';

  const { clienteId, clienteAtivo } = useClienteAtivo();
  const { usuario } = useAuth();
  const usuarioId = usuario?.id ?? null;

  const [search, setSearch] = useState('');
  const [filtroBairro, setFiltroBairro] = useState<string>('__all__');
  const [viewMode, setViewMode] = useState<'lista' | 'mapa'>('lista');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<NovoImovelForm>(EMPTY_FORM);
  const [filtrarPorQuarteirao, setFiltrarPorQuarteirao] = useState(false);

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

  const { data: imoveis = [], isLoading: loadingImoveis } = useImoveis(clienteId);
  const { data: vistorias = [], isLoading: loadingVistorias } = useVistorias(
    clienteId,
    usuarioId,
    currentCiclo,
  );

  const createImovelMutation = useCreateImovelMutation();

  // Quarteirões atribuídos ao agente neste ciclo
  const { data: quarteiraoDoAgente = [] } = useQuarteiroesByAgente(clienteId, usuarioId, currentCiclo);

  // Map imovel_id → latest vistoria status
  const statusPorImovel = useMemo(() => {
    const map = new Map<string, string>();
    const sorted = [...vistorias].sort(
      (a, b) => new Date(b.data_visita).getTime() - new Date(a.data_visita).getTime(),
    );
    for (const v of sorted) {
      if (!map.has(v.imovel_id)) {
        map.set(v.imovel_id, v.status);
      }
    }
    return map;
  }, [vistorias]);

  // Map imovel_id → tem pendência de evidência (assinatura ou foto)
  const pendenciasPorImovel = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const v of vistorias) {
      if (v.pendente_assinatura || v.pendente_foto) {
        map.set(v.imovel_id, true);
      }
    }
    return map;
  }, [vistorias]);

  // Map imovel_id → latest data_visita
  const ultimaVisitaPorImovel = useMemo(() => {
    const map = new Map<string, string>();
    const sorted = [...vistorias].sort(
      (a, b) => new Date(b.data_visita).getTime() - new Date(a.data_visita).getTime(),
    );
    for (const v of sorted) {
      if (!map.has(v.imovel_id)) {
        map.set(v.imovel_id, v.data_visita);
      }
    }
    return map;
  }, [vistorias]);

  const bairrosDistintos = useMemo(() => {
    const set = new Set<string>();
    for (const im of imoveis) {
      if (im.bairro) set.add(im.bairro);
    }
    return Array.from(set).sort();
  }, [imoveis]);

  const imoveisFiltrados = useMemo(() => {
    const q = search.toLowerCase();
    return imoveis.filter((im) => {
      const matchSearch =
        !q ||
        (im.logradouro?.toLowerCase().includes(q) ?? false) ||
        (im.bairro?.toLowerCase().includes(q) ?? false) ||
        (im.quarteirao?.toLowerCase().includes(q) ?? false);
      const matchBairro = filtroBairro === '__all__' || im.bairro === filtroBairro;
      const matchQuarteirao =
        !filtrarPorQuarteirao ||
        quarteiraoDoAgente.length === 0 ||
        (im.quarteirao != null && quarteiraoDoAgente.includes(im.quarteirao));
      return matchSearch && matchBairro && matchQuarteirao;
    });
  }, [imoveis, search, filtroBairro, filtrarPorQuarteirao, quarteiraoDoAgente]);

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

  async function handleCreateImovel() {
    if (!clienteId) return;
    if (!form.logradouro.trim()) {
      toast.error('Logradouro é obrigatório.');
      return;
    }
    try {
      await createImovelMutation.mutateAsync({
        ...form,
        cliente_id: clienteId,
        ativo: true,
      } as Omit<Imovel, 'id' | 'created_at' | 'updated_at'>);
      toast.success('Imóvel cadastrado com sucesso.');
      setDialogOpen(false);
      setForm(EMPTY_FORM);
    } catch (err) {
      toast.error('Erro ao cadastrar imóvel. Tente novamente.');
    }
  }

  const isLoading = loadingImoveis || loadingVistorias;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0"
          onClick={() => navigate('/operador/inicio')}
          aria-label="Voltar"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="font-semibold text-base leading-tight truncate">
            {ATIVIDADE_LABEL[atividade] ?? atividade}
          </h1>
          <p className="text-xs text-muted-foreground">
            {isLoading ? 'Carregando…' : `${imoveisFiltrados.length} imóvel(is)`}
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
            className="pl-9 h-9 text-sm"
          />
        </div>
        {quarteiraoDoAgente.length === 0 && !loadingImoveis ? (
          <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            Nenhum quarteirão atribuído para este ciclo. Contacte o gestor.
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setFiltrarPorQuarteirao((v) => !v)}
            className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-colors ${
              filtrarPorQuarteirao
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background text-muted-foreground border-border/60 hover:border-primary/50'
            }`}
          >
            <Layers className="w-3 h-3" />
            Meus quarteirões ({quarteiraoDoAgente.length})
          </button>
        )}
        <div className="flex gap-2 items-center">
          <Select value={filtroBairro} onValueChange={setFiltroBairro}>
            <SelectTrigger className="h-8 text-xs flex-1">
              <SelectValue placeholder="Todos os bairros" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos os bairros</SelectItem>
              {bairrosDistintos.map((b) => (
                <SelectItem key={b} value={b}>
                  {b}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* View toggle */}
          <div className="flex border rounded-md overflow-hidden shrink-0">
            <Button
              variant={viewMode === 'lista' ? 'default' : 'ghost'}
              size="sm"
              className="h-8 px-2 rounded-none"
              onClick={() => setViewMode('lista')}
              aria-label="Visualização em lista"
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'mapa' ? 'default' : 'ghost'}
              size="sm"
              className="h-8 px-2 rounded-none"
              onClick={() => setViewMode('mapa')}
              aria-label="Visualização em mapa"
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-20 rounded-lg bg-gray-200 animate-pulse" />
            ))}
          </div>
        ) : imoveisFiltrados.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-2">
            <Home className="h-8 w-8 opacity-40" />
            <p className="text-sm">Nenhum imóvel encontrado.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {imoveisFiltrados.map((imovel) => {
              const status = statusPorImovel.get(imovel.id) ?? 'none';
              const ultimaVisita = ultimaVisitaPorImovel.get(imovel.id);
              const borderClass = STATUS_BORDER[status] ?? STATUS_BORDER.none;
              const bloqueado = status === 'visitado' || status === 'fechado';
              const temPendencia = pendenciasPorImovel.get(imovel.id) ?? false;

              return (
                <Card
                  key={imovel.id}
                  className={`${bloqueado ? 'cursor-not-allowed opacity-75' : 'cursor-pointer hover:shadow-md'} transition-shadow ${borderClass}`}
                  onClick={() => {
                    if (bloqueado) {
                      toast.info('Este imóvel já foi finalizado neste ciclo.');
                      return;
                    }
                    navigate(`/agente/vistoria/${imovel.id}?atividade=${atividade}`);
                  }}
                >
                  <CardContent className="p-3 flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm leading-tight truncate">
                        {imovel.numero ? `${imovel.numero} — ` : ''}
                        {imovel.logradouro ?? 'Sem logradouro'}
                      </p>
                      <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3 shrink-0" />
                        <span className="truncate">
                          {[imovel.bairro, imovel.quarteirao ? `Qt. ${imovel.quarteirao}` : null]
                            .filter(Boolean)
                            .join(' · ') || 'Sem localização'}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {ultimaVisita
                          ? `Última visita: ${new Date(ultimaVisita).toLocaleDateString('pt-BR')}`
                          : 'Nunca visitado'}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <Badge variant={STATUS_BADGE_VARIANT[status] ?? 'destructive'} className="text-xs">
                        {STATUS_LABEL[status] ?? status}
                      </Badge>
                      {temPendencia && (
                        <span
                          className="flex items-center gap-0.5 text-[10px] text-amber-600 font-medium"
                          title="Vistoria enviada sem assinatura ou foto"
                        >
                          <AlertTriangle className="h-3 w-3" />
                          Pendente
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* FAB */}
      <Button
        size="icon"
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-20"
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

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="bairro">Bairro</Label>
                <Input
                  id="bairro"
                  placeholder="Ex: Centro"
                  value={form.bairro}
                  onChange={(e) => handleFormChange('bairro', e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="quarteirao">Quarteirão</Label>
                <Input
                  id="quarteirao"
                  placeholder="Ex: 01"
                  value={form.quarteirao}
                  onChange={(e) => handleFormChange('quarteirao', e.target.value)}
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

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setDialogOpen(false);
                  setForm(EMPTY_FORM);
                }}
              >
                Cancelar
              </Button>
              <Button
                className="flex-1"
                onClick={handleCreateImovel}
                disabled={createImovelMutation.isPending}
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
