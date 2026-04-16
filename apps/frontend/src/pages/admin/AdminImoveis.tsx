import { useEffect, useMemo, useState } from 'react';
import { MapPin, Plus, Search, Home, Building2, TreePine, Landmark, Pencil, LocateFixed, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useClienteAtivo } from '@/hooks/useClienteAtivo';
import { useImoveis, useCreateImovelMutation, useUpdateImovelMutation } from '@/hooks/queries/useImoveis';
import type { Imovel, TipoImovel } from '@/types/database';
import { forwardGeocode } from '@/lib/geo';
import { MapContainer, TileLayer, CircleMarker, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

function MapClickPicker({
  onPick,
}: {
  onPick: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click: (event) => {
      onPick(event.latlng.lat, event.latlng.lng);
    },
  });
  return null;
}

function MapInvalidateSizeFix({ trigger }: { trigger: string }) {
  const map = useMap();

  useEffect(() => {
    const t1 = window.setTimeout(() => map.invalidateSize(), 80);
    const t2 = window.setTimeout(() => map.invalidateSize(), 220);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [map, trigger]);

  return null;
}

const TIPO_LABELS: Record<TipoImovel, string> = {
  residencial: 'Residencial',
  comercial: 'Comercial',
  terreno: 'Terreno',
  ponto_estrategico: 'Ponto Estratégico',
};

const TIPO_ICON: Record<TipoImovel, React.ReactNode> = {
  residencial: <Home className="h-3.5 w-3.5" />,
  comercial: <Building2 className="h-3.5 w-3.5" />,
  terreno: <TreePine className="h-3.5 w-3.5" />,
  ponto_estrategico: <Landmark className="h-3.5 w-3.5" />,
};

const TIPO_BADGE_VARIANT: Record<TipoImovel, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  residencial: 'default',
  comercial: 'secondary',
  terreno: 'outline',
  ponto_estrategico: 'secondary',
};

const EMPTY_FORM = {
  tipo_imovel: 'residencial' as TipoImovel,
  logradouro: '',
  numero: '',
  complemento: '',
  bairro: '',
  quarteirao: '',
  latitude: '',
  longitude: '',
  ativo: true,
};

function defaultClienteCoords(clienteLat?: number | null, clienteLng?: number | null) {
  if (typeof clienteLat === 'number' && typeof clienteLng === 'number') {
    return {
      latitude: String(clienteLat),
      longitude: String(clienteLng),
    };
  }
  return { latitude: '', longitude: '' };
}

export default function AdminImoveis() {
  const { clienteId, clienteAtivo } = useClienteAtivo();
  const { data: imoveis = [], isLoading } = useImoveis(clienteId);
  const createImovel = useCreateImovelMutation();
  const updateImovel = useUpdateImovelMutation();

  const [busca, setBusca] = useState('');
  const [filtroBairro, setFiltroBairro] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<TipoImovel | 'todos'>('todos');
  const [filtroAtivo, setFiltroAtivo] = useState<'todos' | 'ativo' | 'inativo'>('todos');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editando, setEditando] = useState<Imovel | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [geocoding, setGeocoding] = useState(false);
  const [clienteCenterFallback, setClienteCenterFallback] = useState<[number, number] | null>(null);

  const enderecoCompletoGeocode = useMemo(() => {
    const cidade = clienteAtivo?.cidade?.trim() || '';
    const uf = (clienteAtivo?.uf || clienteAtivo?.estado || '').trim();
    return [
      form.logradouro.trim(),
      form.numero.trim(),
      form.bairro.trim(),
      cidade,
      uf,
      'Brasil',
    ]
      .filter(Boolean)
      .join(', ');
  }, [form.logradouro, form.numero, form.bairro, clienteAtivo?.cidade, clienteAtivo?.uf, clienteAtivo?.estado]);

  const selectedCoords = useMemo(() => {
    const lat = Number(form.latitude);
    const lng = Number(form.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return [lat, lng] as [number, number];
  }, [form.latitude, form.longitude]);

  const fallbackCenter = useMemo<[number, number]>(() => {
    if (selectedCoords) return selectedCoords;
    if (
      typeof clienteAtivo?.latitude_centro === 'number' &&
      typeof clienteAtivo?.longitude_centro === 'number'
    ) {
      return [clienteAtivo.latitude_centro, clienteAtivo.longitude_centro];
    }
    if (clienteCenterFallback) return clienteCenterFallback;
    return [-20.4697, -54.6201];
  }, [selectedCoords, clienteAtivo?.latitude_centro, clienteAtivo?.longitude_centro, clienteCenterFallback]);

  useEffect(() => {
    // Se cliente já possui centro, não precisa geocodificar município.
    if (
      typeof clienteAtivo?.latitude_centro === 'number' &&
      typeof clienteAtivo?.longitude_centro === 'number'
    ) {
      setClienteCenterFallback([clienteAtivo.latitude_centro, clienteAtivo.longitude_centro]);
      return;
    }

    const cidade = clienteAtivo?.cidade?.trim();
    const uf = (clienteAtivo?.uf || clienteAtivo?.estado || '').trim();
    if (!cidade) return;

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

  // Bairros únicos para o select de filtro
  const bairros = Array.from(new Set(imoveis.map((i) => i.bairro).filter(Boolean))).sort();

  const imoveisFiltrados = imoveis.filter((im) => {
    const matchBusca =
      !busca ||
      im.logradouro?.toLowerCase().includes(busca.toLowerCase()) ||
      im.bairro?.toLowerCase().includes(busca.toLowerCase()) ||
      im.numero?.toLowerCase().includes(busca.toLowerCase());
    const matchBairro = !filtroBairro || im.bairro === filtroBairro;
    const matchTipo = filtroTipo === 'todos' || im.tipo_imovel === filtroTipo;
    const matchAtivo =
      filtroAtivo === 'todos' ||
      (filtroAtivo === 'ativo' && im.ativo) ||
      (filtroAtivo === 'inativo' && !im.ativo);
    return matchBusca && matchBairro && matchTipo && matchAtivo;
  });

  function abrirCadastro() {
    const defaults = defaultClienteCoords(clienteAtivo?.latitude_centro, clienteAtivo?.longitude_centro);
    setEditando(null);
    setForm({ ...EMPTY_FORM, ...defaults });
    setDialogOpen(true);
  }

  function abrirEdicao(im: Imovel) {
    const defaults = defaultClienteCoords(clienteAtivo?.latitude_centro, clienteAtivo?.longitude_centro);
    setEditando(im);
    setForm({
      tipo_imovel: im.tipo_imovel,
      logradouro: im.logradouro ?? '',
      numero: im.numero ?? '',
      complemento: im.complemento ?? '',
      bairro: im.bairro ?? '',
      quarteirao: im.quarteirao ?? '',
      latitude: im.latitude != null ? String(im.latitude) : defaults.latitude,
      longitude: im.longitude != null ? String(im.longitude) : defaults.longitude,
      ativo: im.ativo ?? true,
    });
    setDialogOpen(true);
  }

  async function handleSalvar() {
    if (!clienteId) return;
    if (!form.logradouro.trim() || !form.bairro.trim()) {
      toast.error('Logradouro e bairro são obrigatórios.');
      return;
    }

    const latFallback = typeof clienteAtivo?.latitude_centro === 'number' ? clienteAtivo.latitude_centro : null;
    const lngFallback = typeof clienteAtivo?.longitude_centro === 'number' ? clienteAtivo.longitude_centro : null;
    const latFinal = form.latitude ? parseFloat(form.latitude) : latFallback;
    const lngFinal = form.longitude ? parseFloat(form.longitude) : lngFallback;

    const payload = {
      tipo_imovel: form.tipo_imovel,
      logradouro: form.logradouro.trim(),
      numero: form.numero.trim() || null,
      complemento: form.complemento.trim() || null,
      bairro: form.bairro.trim(),
      quarteirao: form.quarteirao.trim() || null,
      latitude: latFinal,
      longitude: lngFinal,
      ativo: form.ativo,
    };

    try {
      if (editando) {
        await updateImovel.mutateAsync({ id: editando.id, payload });
        toast.success('Imóvel atualizado.');
      } else {
        await createImovel.mutateAsync({ cliente_id: clienteId, regiao_id: null, ...payload });
        toast.success('Imóvel cadastrado.');
      }
      setDialogOpen(false);
    } catch (err) {
      toast.error(`Erro ao salvar: ${err instanceof Error ? err.message : 'Tente novamente.'}`);
    }
  }

  async function handleLocalizarEndereco() {
    if (!form.logradouro.trim() || !form.bairro.trim()) {
      toast.error('Preencha ao menos logradouro e bairro para localizar no mapa.');
      return;
    }

    try {
      setGeocoding(true);
      const result = await forwardGeocode(enderecoCompletoGeocode);
      if (!result) {
        toast.error('Endereço não encontrado. Revise os campos e tente novamente.');
        return;
      }

      setForm((prev) => ({
        ...prev,
        latitude: String(result.lat),
        longitude: String(result.lng),
      }));
      toast.success('Coordenadas localizadas com sucesso.');
    } catch (err) {
      toast.error(`Falha ao localizar endereço: ${err instanceof Error ? err.message : 'tente novamente.'}`);
    } finally {
      setGeocoding(false);
    }
  }

  async function toggleAtivo(im: Imovel) {
    try {
      await updateImovel.mutateAsync({ id: im.id, payload: { ativo: !im.ativo } });
      toast.success(im.ativo ? 'Imóvel desativado.' : 'Imóvel reativado.');
    } catch {
      toast.error('Erro ao atualizar imóvel.');
    }
  }

  const totalAtivos = imoveis.filter((i) => i.ativo).length;
  const totalDrone = imoveis.filter((i) => i.prioridade_drone).length;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <MapPin className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Imóveis</h1>
            <p className="text-sm text-muted-foreground">
              Cadastro e gestão de imóveis do cliente
            </p>
          </div>
        </div>
        <Button onClick={abrirCadastro} className="gap-2">
          <Plus className="h-4 w-4" />
          Novo imóvel
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Total</p>
          <p className="text-2xl font-bold mt-1">{imoveis.length}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Ativos</p>
          <p className="text-2xl font-bold mt-1 text-emerald-600">{totalAtivos}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Inativos</p>
          <p className="text-2xl font-bold mt-1 text-muted-foreground">{imoveis.length - totalAtivos}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Prio. Drone</p>
          <p className="text-2xl font-bold mt-1 text-amber-600">{totalDrone}</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar logradouro, bairro..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={filtroBairro || '_todos'} onValueChange={(v) => setFiltroBairro(v === '_todos' ? '' : v)}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Bairro" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_todos">Todos os bairros</SelectItem>
            {bairros.map((b) => (
              <SelectItem key={b} value={b}>{b}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filtroTipo} onValueChange={(v) => setFiltroTipo(v as TipoImovel | 'todos')}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            {(Object.keys(TIPO_LABELS) as TipoImovel[]).map((t) => (
              <SelectItem key={t} value={t}>{TIPO_LABELS[t]}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filtroAtivo} onValueChange={(v) => setFiltroAtivo(v as 'todos' | 'ativo' | 'inativo')}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="ativo">Ativos</SelectItem>
            <SelectItem value="inativo">Inativos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabela */}
      <div className="rounded-xl border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Endereço</TableHead>
              <TableHead>Bairro</TableHead>
              <TableHead>Quadra</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Flags</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-24">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  Carregando...
                </TableCell>
              </TableRow>
            )}
            {!isLoading && imoveisFiltrados.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  Nenhum imóvel encontrado.
                </TableCell>
              </TableRow>
            )}
            {imoveisFiltrados.map((im) => (
              <TableRow key={im.id} className={!im.ativo ? 'opacity-50' : ''}>
                <TableCell className="font-medium">
                  {[im.logradouro, im.numero, im.complemento].filter(Boolean).join(', ')}
                </TableCell>
                <TableCell className="text-muted-foreground">{im.bairro}</TableCell>
                <TableCell className="text-muted-foreground">{im.quarteirao || '—'}</TableCell>
                <TableCell>
                  <Badge variant={TIPO_BADGE_VARIANT[im.tipo_imovel]} className="gap-1 text-xs">
                    {TIPO_ICON[im.tipo_imovel]}
                    {TIPO_LABELS[im.tipo_imovel]}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1 flex-wrap">
                    {im.prioridade_drone && (
                      <Badge variant="destructive" className="text-xs gap-1">
                        <MapPin className="h-3 w-3" />
                        Drone
                      </Badge>
                    )}
                    {im.tem_calha && (
                      <Badge variant="outline" className="text-xs">Calha</Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={im.ativo ? 'default' : 'secondary'} className="text-xs">
                    {im.ativo ? 'Ativo' : 'Inativo'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => abrirEdicao(im)}
                      title="Editar"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 text-xs"
                      onClick={() => toggleAtivo(im)}
                      title={im.ativo ? 'Desativar' : 'Reativar'}
                    >
                      {im.ativo ? 'Desativar' : 'Reativar'}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">
        Exibindo {imoveisFiltrados.length} de {imoveis.length} imóveis
      </p>

      {/* Dialog cadastro/edição */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editando ? 'Editar imóvel' : 'Novo imóvel'}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Tipo *</Label>
              <Select
                value={form.tipo_imovel}
                onValueChange={(v) => setForm((f) => ({ ...f, tipo_imovel: v as TipoImovel }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(TIPO_LABELS) as TipoImovel[]).map((t) => (
                    <SelectItem key={t} value={t}>{TIPO_LABELS[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 grid gap-2">
                <Label>Logradouro *</Label>
                <Input
                  value={form.logradouro}
                  onChange={(e) => setForm((f) => ({ ...f, logradouro: e.target.value }))}
                  placeholder="Rua, Av., Travessa..."
                />
              </div>
              <div className="grid gap-2">
                <Label>Número</Label>
                <Input
                  value={form.numero}
                  onChange={(e) => setForm((f) => ({ ...f, numero: e.target.value }))}
                  placeholder="123"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Complemento</Label>
              <Input
                value={form.complemento}
                onChange={(e) => setForm((f) => ({ ...f, complemento: e.target.value }))}
                placeholder="Apto, Bloco..."
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Bairro *</Label>
                <Input
                  value={form.bairro}
                  onChange={(e) => setForm((f) => ({ ...f, bairro: e.target.value }))}
                  placeholder="Nome do bairro"
                />
              </div>
              <div className="grid gap-2">
                <Label>Quarteirão</Label>
                <Input
                  value={form.quarteirao}
                  onChange={(e) => setForm((f) => ({ ...f, quarteirao: e.target.value }))}
                  placeholder="Q-01"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Latitude</Label>
                <Input
                  value={form.latitude}
                  onChange={(e) => setForm((f) => ({ ...f, latitude: e.target.value }))}
                  placeholder="-20.123456"
                  type="number"
                  step="any"
                />
              </div>
              <div className="grid gap-2">
                <Label>Longitude</Label>
                <Input
                  value={form.longitude}
                  onChange={(e) => setForm((f) => ({ ...f, longitude: e.target.value }))}
                  placeholder="-43.123456"
                  type="number"
                  step="any"
                />
              </div>
            </div>

            <div className="rounded-lg border p-3 bg-muted/30 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">Localização do imóvel</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {enderecoCompletoGeocode || 'Preencha o endereço para localizar'}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleLocalizarEndereco}
                  disabled={geocoding || !form.logradouro.trim() || !form.bairro.trim()}
                  className="gap-2"
                >
                  {geocoding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LocateFixed className="h-3.5 w-3.5" />}
                  {geocoding ? 'Localizando...' : 'Localizar endereço'}
                </Button>
              </div>

              {form.latitude && form.longitude ? (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground font-mono">
                    {Number(form.latitude).toFixed(6)}, {Number(form.longitude).toFixed(6)}
                  </p>
                  <div className="rounded-md overflow-hidden border h-48 isolate">
                    <MapContainer
                      center={fallbackCenter}
                      zoom={selectedCoords ? 16 : 13}
                      className="w-full h-full"
                    >
                      <MapInvalidateSizeFix
                        trigger={`${dialogOpen}-${fallbackCenter[0]}-${fallbackCenter[1]}-${selectedCoords?.[0] ?? 'na'}-${selectedCoords?.[1] ?? 'na'}`}
                      />
                      <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      />
                      <MapClickPicker
                        onPick={(lat, lng) => {
                          setForm((prev) => ({
                            ...prev,
                            latitude: String(lat),
                            longitude: String(lng),
                          }));
                        }}
                      />
                      {selectedCoords ? (
                        <CircleMarker
                          center={selectedCoords}
                          radius={8}
                          pathOptions={{ color: '#16a34a', fillColor: '#16a34a', fillOpacity: 0.7 }}
                        />
                      ) : null}
                    </MapContainer>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Clique no mapa para ajustar latitude/longitude manualmente.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="rounded-md overflow-hidden border h-48 isolate">
                    <MapContainer center={fallbackCenter} zoom={13} className="w-full h-full">
                      <MapInvalidateSizeFix
                        trigger={`${dialogOpen}-${fallbackCenter[0]}-${fallbackCenter[1]}-empty`}
                      />
                      <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      />
                      <MapClickPicker
                        onPick={(lat, lng) => {
                          setForm((prev) => ({
                            ...prev,
                            latitude: String(lat),
                            longitude: String(lng),
                          }));
                        }}
                      />
                    </MapContainer>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Sem coordenadas definidas. Use "Localizar endereço" ou clique no mapa para preencher latitude/longitude.
                  </p>
                </div>
              )}
            </div>

            {editando && (
              <div className="flex items-center gap-3">
                <Label>Status</Label>
                <Select
                  value={form.ativo ? 'ativo' : 'inativo'}
                  onValueChange={(v) => setForm((f) => ({ ...f, ativo: v === 'ativo' }))}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="inativo">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSalvar}
              disabled={createImovel.isPending || updateImovel.isPending}
            >
              {createImovel.isPending || updateImovel.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
