import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useClienteAtivo } from '@/hooks/useClienteAtivo';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/services/api';
import { STALE } from '@/lib/queryConfig';
import { UnidadeSaude, TipoUnidadeSaude, TipoSentinelaUnidade, UnidadesSaudeSyncControle } from '@/types/database';
import { forwardGeocode } from '@/lib/geo';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import {
  Loader2, Plus, Pencil, Search, ArrowLeft, RefreshCw, AlertTriangle,
  CheckCircle2, XCircle, Clock, LocateFixed,
} from 'lucide-react';
import AdminPageHeader from '@/components/AdminPageHeader';
import MobileListCard from '@/components/admin/MobileListCard';
import ConfirmDialog from '@/components/admin/ConfirmDialog';
import { useCnesSyncControle, useSincronizarCnesMutation } from '@/hooks/queries/useCnesSyncControle';

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
    // Evita mapa renderizar com tamanho incorreto dentro de layout/step condicionado.
    const t1 = window.setTimeout(() => map.invalidateSize(), 80);
    const t2 = window.setTimeout(() => map.invalidateSize(), 220);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [map, trigger]);

  return null;
}

// ── Labels e cores ──────────────────────────────────────────────────────────

const TIPO_LABELS: Record<TipoUnidadeSaude, string> = {
  ubs: 'UBS',
  upa: 'UPA',
  hospital: 'Hospital',
  outro: 'Outro',
};

const TIPO_COLORS: Record<TipoUnidadeSaude, string> = {
  ubs: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30',
  upa: 'bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30',
  hospital: 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30',
  outro: 'bg-muted/60 text-muted-foreground border-border',
};

const SENTINELA_COLORS: Record<TipoSentinelaUnidade, string> = {
  UBS: 'bg-blue-500/10 text-blue-600 border-blue-400/30',
  USF: 'bg-cyan-500/10 text-cyan-700 border-cyan-400/30',
  UPA: 'bg-orange-500/10 text-orange-700 border-orange-400/30',
  HOSPITAL: 'bg-red-500/10 text-red-700 border-red-400/30',
  CEM: 'bg-purple-500/10 text-purple-700 border-purple-400/30',
  VIGILANCIA: 'bg-yellow-500/10 text-yellow-700 border-yellow-400/30',
  OUTRO: 'bg-muted/60 text-muted-foreground border-border',
};

// ── Componente do painel de sincronização CNES ──────────────────────────────

function SyncStatusBadge({ status }: { status: UnidadesSaudeSyncControle['status'] }) {
  if (status === 'sucesso') {
    return (
      <Badge variant="outline" className="bg-green-500/15 text-green-700 border-green-500/30 gap-1">
        <CheckCircle2 className="w-3 h-3" /> Sucesso
      </Badge>
    );
  }
  if (status === 'erro') {
    return (
      <Badge variant="outline" className="bg-red-500/15 text-red-700 border-red-500/30 gap-1">
        <XCircle className="w-3 h-3" /> Erro
      </Badge>
    );
  }
  if (status === 'em_andamento') {
    return (
      <Badge variant="outline" className="bg-amber-500/15 text-amber-700 border-amber-500/30 gap-1">
        <Loader2 className="w-3 h-3 animate-spin" /> Em andamento
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="bg-muted/60 text-muted-foreground border-border gap-1">
      <Clock className="w-3 h-3" /> Pendente
    </Badge>
  );
}

function CnesSyncPanel({
  clienteId,
  usuarioId,
  clienteTemConfig,
}: {
  clienteId: string;
  usuarioId: string;
  clienteTemConfig: boolean;
}) {
  const { data: historico = [], isLoading } = useCnesSyncControle(clienteId);
  const syncMutation = useSincronizarCnesMutation();

  const ultima = historico[0] ?? null;
  const emAndamento = historico.some((h) => h.status === 'em_andamento');

  const handleSincronizar = async () => {
    try {
      await syncMutation.mutateAsync({ clienteId, usuarioId });
      toast.success('Sincronização iniciada. Os dados serão atualizados em instantes.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao iniciar sincronização');
    }
  };

  const fmtDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—';

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">Sincronização CNES/DATASUS</CardTitle>
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            ) : ultima ? (
              <SyncStatusBadge status={ultima.status} />
            ) : (
              <Badge variant="outline" className="bg-muted/60 text-muted-foreground border-border">
                Nunca executado
              </Badge>
            )}
          </div>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2"
                  disabled={!clienteTemConfig || emAndamento || syncMutation.isPending}
                  onClick={handleSincronizar}
                >
                  {emAndamento || syncMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  {emAndamento ? 'Aguarde...' : syncMutation.isPending ? 'Sincronizando...' : 'Sincronizar agora'}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {clienteTemConfig
                  ? 'Busca dados atualizados do CNES/DATASUS para este município'
                  : 'Configure o UF e código IBGE do município antes de sincronizar'}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {!clienteTemConfig && (
          <Alert className="mt-2 border-amber-500/30 bg-amber-500/10">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <AlertDescription className="text-amber-700 text-sm">
              Configure o <strong>UF</strong> e o <strong>código IBGE</strong> do município nas configurações do
              cliente para habilitar a sincronização automática com o CNES/DATASUS.
            </AlertDescription>
          </Alert>
        )}

        {ultima && ultima.status !== 'em_andamento' && (
          <p className="text-xs text-muted-foreground mt-1">
            Última execução: {fmtDate(ultima.finalizado_em ?? ultima.iniciado_em)}
            {ultima.status === 'sucesso' && (
              <> — {ultima.total_inseridos ?? 0} inseridas, {ultima.total_atualizados ?? 0} atualizadas, {ultima.total_inativados ?? 0} inativadas</>
            )}
          </p>
        )}
      </CardHeader>

      {historico.length > 0 && (
        <CardContent className="pt-0">
          <Accordion type="single" collapsible>
            <AccordionItem value="historico" className="border-none">
              <AccordionTrigger className="text-xs text-muted-foreground hover:text-foreground py-1 [&>svg]:w-3 [&>svg]:h-3">
                Ver histórico ({historico.length} execuções)
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-1.5 pt-1">
                  {historico.slice(0, 5).map((h) => (
                    <div
                      key={h.id}
                      className="flex items-start justify-between gap-2 text-xs p-2 rounded-md bg-muted/40"
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <SyncStatusBadge status={h.status} />
                        <span className="text-muted-foreground capitalize">{h.origem_execucao}</span>
                        <span className="text-muted-foreground">{fmtDate(h.iniciado_em)}</span>
                      </div>
                      {h.status === 'sucesso' && (
                        <span className="text-muted-foreground whitespace-nowrap">
                          +{h.total_inseridos ?? 0} / ~{h.total_atualizados ?? 0} / -{h.total_inativados ?? 0}
                        </span>
                      )}
                      {h.status === 'erro' && h.erro_mensagem && (
                        <span className="text-red-600 truncate max-w-[200px]" title={h.erro_mensagem}>
                          {h.erro_mensagem}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      )}
    </Card>
  );
}

// ── Formulário ──────────────────────────────────────────────────────────────

const emptyForm = {
  nome: '',
  tipo: 'ubs' as TipoUnidadeSaude,
  endereco: '',
  latitude: '',
  longitude: '',
  ativo: true,
};

// ── Componente principal ────────────────────────────────────────────────────

export default function AdminUnidadesSaude() {
  const { clienteId, clienteAtivo } = useClienteAtivo();
  const { usuario } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [somenteAtivos, setSomenteAtivos] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<UnidadeSaude | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [confirmDialog, setConfirmDialog] = useState<{ title: string; description: string; onConfirm: () => void } | null>(null);
  const [clienteCenterFallback, setClienteCenterFallback] = useState<[number, number] | null>(null);
  const [geocoding, setGeocoding] = useState(false);

  const getErrorMessage = (err: unknown) => {
    const maybe = err as { message?: unknown } | null;
    if (maybe?.message && typeof maybe.message === 'string') return maybe.message;
    return 'Erro ao salvar';
  };

  const parseCoord = (raw: string): number | null => {
    if (raw === '') return null;
    // Replaces unicode minus (common in some copy/paste/formatters) and supports comma decimals.
    const normalized = raw.trim().replace(/[−–]/g, '-').replace(',', '.');
    const n = Number(normalized);
    if (!Number.isFinite(n)) return null;
    return n;
  };

  const enderecoCompletoGeocode = useMemo(() => {
    const endereco = form.endereco.trim();
    const cidade = clienteAtivo?.cidade?.trim();
    const uf = (clienteAtivo?.uf || clienteAtivo?.estado || '').trim();
    return [endereco, cidade, uf, 'Brasil'].filter(Boolean).join(', ');
  }, [form.endereco, clienteAtivo?.cidade, clienteAtivo?.uf, clienteAtivo?.estado]);

  const handleLocalizarEndereco = async () => {
    if (!form.endereco.trim()) {
      toast.error('Endereço é obrigatório para localizar');
      return;
    }
    try {
      setGeocoding(true);
      const result = await forwardGeocode(enderecoCompletoGeocode);
      if (!result) {
        toast.error('Não foi possível localizar o endereço.');
        return;
      }
      setForm((prev) => ({
        ...prev,
        latitude: String(result.lat),
        longitude: String(result.lng),
      }));
      toast.success('Endereço localizado');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setGeocoding(false);
    }
  };

  // Buscar dados do cliente para verificar uf/ibge_municipio
  const { data: cliente } = useQuery({
    queryKey: ['admin_clientes_single', clienteId],
    queryFn: () => api.clientes.getConfig(clienteId!),
    enabled: !!clienteId,
    staleTime: STALE.STATIC,
  });

  const clienteTemConfig = !!(cliente?.uf && cliente?.ibge_municipio);

  const { data: unidades = [], isLoading: loading } = useQuery({
    queryKey: ['admin_unidades_saude', clienteId],
    queryFn: () => api.unidadesSaude.list(clienteId!),
    enabled: !!clienteId,
    staleTime: STALE.MEDIUM,
  });

  const filtradas = useMemo(() => {
    return unidades.filter((u) => {
      if (somenteAtivos && !u.ativo) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!u.nome.toLowerCase().includes(q) && !(u.endereco || '').toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [unidades, somenteAtivos, search]);

  const selectedCoords = useMemo(() => {
    const lat = parseCoord(form.latitude);
    const lng = parseCoord(form.longitude);
    if (lat == null || lng == null) return null;
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
    // Se o cliente já tem centro, evita geocodificar novamente.
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

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!clienteId) throw new Error('Cliente não selecionado');

      const lat = parseCoord(form.latitude);
      const lng = parseCoord(form.longitude);
      if (lat !== null && (lat < -90 || lat > 90)) throw new Error('Latitude inválida');
      if (lng !== null && (lng < -180 || lng > 180)) throw new Error('Longitude inválida');

      const payload = {
        cliente_id: clienteId,
        nome: form.nome.trim(),
        tipo: form.tipo,
        endereco: form.endereco.trim() || null,
        latitude: lat,
        longitude: lng,
        ativo: form.ativo,
      };
      if (editing) {
        await api.unidadesSaude.update(editing.id, payload);
      } else {
        await api.unidadesSaude.create(payload as Omit<UnidadeSaude, 'id' | 'created_at' | 'updated_at'>);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_unidades_saude', clienteId] });
      setShowForm(false);
      toast.success(editing ? 'Unidade atualizada' : 'Unidade cadastrada');
    },
    onError: (err: unknown) => {
      // Ajuda a identificar erros reais do Supabase no toast/console.
      // (supabase normalmente retorna um objeto com `message` mas não necessariamente um `Error` instance)
      // eslint-disable-next-line no-console
      console.error('[AdminUnidadesSaude] Erro ao salvar', err);
      toast.error(getErrorMessage(err));
    },
  });

  const toggleAtivoMutation = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      await api.unidadesSaude.update(id, { ativo });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_unidades_saude', clienteId] });
      toast.success('Status atualizado');
    },
    onError: (err: unknown) => {
      // eslint-disable-next-line no-console
      console.error('[AdminUnidadesSaude] Erro ao atualizar status', err);
      toast.error(getErrorMessage(err));
    },
  });

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (u: UnidadeSaude) => {
    setEditing(u);
    setForm({
      nome: u.nome,
      tipo: u.tipo,
      endereco: u.endereco || '',
      latitude: u.latitude !== null ? String(u.latitude) : '',
      longitude: u.longitude !== null ? String(u.longitude) : '',
      ativo: u.ativo,
    });
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome.trim()) { toast.error('Nome obrigatório'); return; }
    saveMutation.mutate();
  };

  // Usa ID interno da tabela usuarios (nao auth.users) para evitar falha de FK na Edge Function.
  const usuarioId = usuario?.id;

  if (showForm) {
    return (
      <div className="space-y-6">
        <AdminPageHeader
          title={editing ? 'Editar Unidade de Saúde' : 'Nova Unidade de Saúde'}
          description={editing ? `Editando: ${editing.nome}` : 'Cadastre uma nova unidade de saúde vinculada ao cliente.'}
        />
        <Card>
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-4 max-w-lg mx-auto">
              <div className="space-y-1.5">
                <Label htmlFor="nome">Nome *</Label>
                <Input
                  id="nome"
                  value={form.nome}
                  onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                  placeholder="Nome da unidade"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="tipo">Tipo</Label>
                <Select value={form.tipo} onValueChange={(v) => setForm((f) => ({ ...f, tipo: v as TipoUnidadeSaude }))}>
                  <SelectTrigger id="tipo">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ubs">UBS</SelectItem>
                    <SelectItem value="upa">UPA</SelectItem>
                    <SelectItem value="hospital">Hospital</SelectItem>
                    <SelectItem value="outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="endereco">Endereço</Label>
                <Input
                  id="endereco"
                  value={form.endereco}
                  onChange={(e) => setForm((f) => ({ ...f, endereco: e.target.value }))}
                  placeholder="Rua, número, bairro"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="latitude">Latitude</Label>
                  <Input
                    id="latitude"
                    type="number"
                    step="any"
                    value={form.latitude}
                    onChange={(e) => setForm((f) => ({ ...f, latitude: e.target.value }))}
                    placeholder="-23.5505"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="longitude">Longitude</Label>
                  <Input
                    id="longitude"
                    type="number"
                    step="any"
                    value={form.longitude}
                    onChange={(e) => setForm((f) => ({ ...f, longitude: e.target.value }))}
                    placeholder="-46.6333"
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
                    disabled={geocoding || !form.endereco.trim()}
                    className="gap-2"
                  >
                    {geocoding ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <LocateFixed className="h-3.5 w-3.5" />
                    )}
                    {geocoding ? 'Localizando...' : 'Localizar endereço'}
                  </Button>
                </div>

                {selectedCoords ? (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground font-mono">
                      {selectedCoords[0].toFixed(6)}, {selectedCoords[1].toFixed(6)}
                    </p>

                    <div className="rounded-md overflow-hidden border h-48 isolate">
                      <MapContainer
                        center={fallbackCenter}
                        zoom={16}
                        className="w-full h-full"
                      >
                        <MapInvalidateSizeFix
                          trigger={`unidades-${editing?.id ?? 'novo'}-${fallbackCenter[0]}-${fallbackCenter[1]}-${selectedCoords[0]}-${selectedCoords[1]}`}
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
                        <CircleMarker
                          center={selectedCoords}
                          radius={8}
                          pathOptions={{
                            color: '#16a34a',
                            fillColor: '#16a34a',
                            fillOpacity: 0.7,
                          }}
                        />
                      </MapContainer>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="rounded-md overflow-hidden border h-48 isolate">
                      <MapContainer
                        center={fallbackCenter}
                        zoom={13}
                        className="w-full h-full"
                      >
                        <MapInvalidateSizeFix
                          trigger={`unidades-${editing?.id ?? 'novo'}-${fallbackCenter[0]}-${fallbackCenter[1]}-sem-coords`}
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
                    <p className="text-[11px] text-muted-foreground">
                      Sem coordenadas definidas. Clique no mapa para preencher latitude/longitude.
                    </p>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3 pt-1">
                <Switch
                  id="ativo"
                  checked={form.ativo}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, ativo: v }))}
                />
                <Label htmlFor="ativo">Ativo</Label>
              </div>

              <div className="flex gap-3 pt-2 justify-end">
                <Button type="submit" disabled={saveMutation.isPending}>
                  {saveMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {editing ? 'Salvar alterações' : 'Cadastrar'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                  <ArrowLeft className="w-4 h-4 mr-2" /> Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {confirmDialog && (
          <ConfirmDialog
            open
            onOpenChange={(v) => { if (!v) setConfirmDialog(null); }}
            title={confirmDialog.title}
            description={confirmDialog.description}
            onConfirm={() => { confirmDialog.onConfirm(); setConfirmDialog(null); }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Unidades de Saúde"
        description="Postos de saúde, UPAs e hospitais que registram notificações de casos."
      />

      {/* Painel de sincronização CNES */}
      {clienteId && (
        <CnesSyncPanel
          clienteId={clienteId}
          usuarioId={usuarioId}
          clienteTemConfig={clienteTemConfig}
        />
      )}

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou endereço..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Switch id="ativos" checked={somenteAtivos} onCheckedChange={setSomenteAtivos} />
          <Label htmlFor="ativos" className="text-sm cursor-pointer">Apenas ativos</Label>
        </div>
        <Button onClick={openCreate} size="sm" className="gap-2 ml-auto sm:ml-0">
          <Plus className="w-4 h-4" /> Nova unidade
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtradas.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhuma unidade encontrada.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Desktop table */}
          <Card className="hidden md:block">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Endereço</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-24 text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtradas.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.nome}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Badge variant="outline" className={TIPO_COLORS[u.tipo]}>
                            {TIPO_LABELS[u.tipo]}
                          </Badge>
                          {u.tipo_sentinela && u.tipo_sentinela !== 'OUTRO' && (
                            <Badge variant="outline" className={`text-xs ${SENTINELA_COLORS[u.tipo_sentinela]}`}>
                              {u.tipo_sentinela}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {u.endereco || '—'}
                      </TableCell>
                      <TableCell>
                        {u.origem === 'cnes_sync' ? (
                          <Badge variant="outline" className="bg-blue-500/10 text-blue-700 border-blue-400/30 gap-1 text-xs">
                            <RefreshCw className="w-2.5 h-2.5" /> CNES
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">Manual</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={u.ativo
                          ? 'bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30'
                          : 'bg-muted/60 text-muted-foreground border-border'
                        }>
                          {u.ativo ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEdit(u)}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-xs"
                            onClick={() => setConfirmDialog({
                              title: u.ativo ? 'Desativar unidade?' : 'Reativar unidade?',
                              description: u.ativo
                                ? `A unidade "${u.nome}" ficará inativa e não aparecerá na lista de notificação.`
                                : `A unidade "${u.nome}" voltará a aparecer nas opções de notificação.`,
                              onConfirm: () => toggleAtivoMutation.mutate({ id: u.id, ativo: !u.ativo }),
                            })}
                          >
                            {u.ativo ? 'Desativar' : 'Reativar'}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {filtradas.map((u) => (
              <MobileListCard
                key={u.id}
                title={u.nome}
                badges={
                  <>
                    <Badge variant="outline" className={TIPO_COLORS[u.tipo]}>
                      {TIPO_LABELS[u.tipo]}
                    </Badge>
                    {u.tipo_sentinela && u.tipo_sentinela !== 'OUTRO' && (
                      <Badge variant="outline" className={`text-xs ${SENTINELA_COLORS[u.tipo_sentinela]}`}>
                        {u.tipo_sentinela}
                      </Badge>
                    )}
                    {u.origem === 'cnes_sync' && (
                      <Badge variant="outline" className="bg-blue-500/10 text-blue-700 border-blue-400/30 gap-1 text-xs">
                        <RefreshCw className="w-2.5 h-2.5" /> CNES
                      </Badge>
                    )}
                    <Badge variant="outline" className={u.ativo
                      ? 'bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30'
                      : 'bg-muted/60 text-muted-foreground border-border'
                    }>
                      {u.ativo ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </>
                }
                fields={[
                  { label: 'Endereço', value: u.endereco || '—' },
                  { label: 'Bairro', value: u.bairro || '—' },
                ]}
                onEdit={() => openEdit(u)}
              />
            ))}
          </div>
        </>
      )}

      {confirmDialog && (
        <ConfirmDialog
          open
          onOpenChange={(v) => { if (!v) setConfirmDialog(null); }}
          title={confirmDialog.title}
          description={confirmDialog.description}
          onConfirm={() => { confirmDialog.onConfirm(); setConfirmDialog(null); }}
        />
      )}
    </div>
  );
}
