import { useState, lazy, Suspense } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/services/api';
import { useClienteAtivo } from '@/hooks/useClienteAtivo';
import { usePagination } from '@/hooks/usePagination';
import TablePagination from '@/components/TablePagination';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, Plus, Pencil, Trash2, Search, ArrowLeft, MapPin, Download, LocateFixed } from 'lucide-react';
import { Regiao } from '@/types/database';
import AdminPageHeader from '@/components/AdminPageHeader';
import MobileListCard from '@/components/admin/MobileListCard';
import ConfirmDialog from '@/components/admin/ConfirmDialog';
import { getErrorMessage } from '@/lib/utils';

const DrawPolygonMap = lazy(() => import('@/components/map/DrawPolygonMap'));

const emptyForm = {
  regiao: '',
  latitude: '',
  longitude: '',
  area: null as Record<string, unknown> | null,
};

const AdminRegioes = () => {
  const { isAdmin } = useAuth();
  const { clienteId, clienteAtivo } = useClienteAtivo();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Regiao | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [importing, setImporting] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{ title: string; description: string; onConfirm: () => void } | null>(null);

  const { data: regioes = [], isLoading: loading } = useQuery({
    queryKey: ['admin_regioes', clienteId],
    queryFn: () => api.regioes.listAll(clienteId ?? undefined),
    enabled: true,
    staleTime: 0,
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: typeof emptyForm & { id?: string }) => {
      const { id, ...fields } = payload;
      const record = {
        cliente_id: clienteId,
        regiao: fields.regiao.trim(),
        latitude: fields.latitude ? parseFloat(fields.latitude) : null,
        longitude: fields.longitude ? parseFloat(fields.longitude) : null,
        area: fields.area,
        updated_at: new Date().toISOString(),
      };
      if (id) {
        await api.regioes.update(id, record);
      } else {
        await api.regioes.create(record as Parameters<typeof api.regioes.create>[0]);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_regioes', clienteId] });
      setShowForm(false);
      setEditing(null);
      toast.success(editing ? 'Região atualizada' : 'Região cadastrada');
    },
    onError: (err: unknown) => toast.error(err instanceof Error ? err.message : 'Erro ao salvar'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.regioes.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_regioes', clienteId] });
      toast.success('Região excluída');
    },
    onError: (err: unknown) => toast.error(err instanceof Error ? err.message : 'Erro ao excluir'),
  });

  const handleGeocode = async (silent = false) => {
    const nome = form.regiao.trim();
    if (!nome) { if (!silent) toast.error('Digite o nome da região primeiro'); return; }
    setGeocoding(true);
    try {
      // Compose query: "bairro, cidade" for better accuracy
      const cidade = clienteAtivo?.cidade || clienteAtivo?.nome || '';
      const query = cidade ? `${nome}, ${cidade}` : nome;
      const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=pt&format=json`;
      const res = await fetch(url);
      const data = await res.json();
      const results = data.results;
      if (!results || results.length === 0) {
        if (!silent) toast.error(`Nenhum resultado encontrado para "${query}"`);
        return;
      }
      interface GeocodingResult {
        country_code?: string;
        latitude: number;
        longitude: number;
        name: string;
        admin1?: string;
        country?: string;
      }
      const brResult = (results as GeocodingResult[]).find((r) => r.country_code === 'BR') || (results as GeocodingResult[])[0];
      setForm(p => ({
        ...p,
        latitude: brResult.latitude.toString(),
        longitude: brResult.longitude.toString(),
      }));
      toast.success(`Coordenadas encontradas: ${brResult.name}, ${brResult.admin1 || brResult.country}`);
    } catch {
      if (!silent) toast.error('Erro ao buscar coordenadas');
    } finally {
      setGeocoding(false);
    }
  };

  const handleRegiaoBlur = () => {
    const nome = form.regiao.trim();
    if (!nome) return;
    // Only auto-geocode if lat/long are still the client defaults or empty
    const isDefault = !form.latitude || !form.longitude ||
      form.latitude === (clienteAtivo?.latitude_centro?.toString() ?? '') ||
      form.longitude === (clienteAtivo?.longitude_centro?.toString() ?? '');
    if (isDefault) {
      handleGeocode(true);
    }
  };


  const openCreate = () => {
    setEditing(null);
    setForm({
      ...emptyForm,
      latitude: clienteAtivo?.latitude_centro?.toString() ?? '',
      longitude: clienteAtivo?.longitude_centro?.toString() ?? '',
    });
    setShowForm(true);
  };

  const openEdit = (r: Regiao) => {
    setEditing(r);
    setForm({
      regiao: r.regiao,
      latitude: r.latitude?.toString() ?? '',
      longitude: r.longitude?.toString() ?? '',
      area: r.area ?? null,
    });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditing(null);
  };

  const handleSave = () => {
    if (!form.regiao.trim()) { toast.error('Nome da região é obrigatório'); return; }
    if (!clienteId) { toast.error('Selecione um cliente'); return; }
    saveMutation.mutate({ ...form, ...(editing ? { id: editing.id } : {}) });
  };

  const handleDelete = (r: Regiao) => {
    setConfirmDialog({
      title: 'Excluir região',
      description: `Excluir a região "${r.regiao}"? Esta ação não pode ser desfeita.`,
      onConfirm: () => deleteMutation.mutate(r.id),
    });
  };

  const handleImportJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!clienteId) { toast.error('Selecione um cliente ativo'); return; }

    setImporting(true);
    try {
      const text = await file.text();
      const json = JSON.parse(text);

      const items = Array.isArray(json) ? json : json.items || json.dados || [];
      if (!Array.isArray(items) || items.length === 0) {
        throw new Error('Formato JSON inválido. Esperado um array de regiões.');
      }

      if (items.length > 500) {
        throw new Error('Máximo de 500 regiões por importação');
      }

      let insertedCount = 0;
      let skippedCount = 0;
      let lastError = null;

      const newRegioes = [];

      for (let item of items) {
        if (typeof item === 'string') {
          try { item = JSON.parse(item); } catch (e) { /* ignore */ }
        }

        let nome = item?.bairro || item?.regiao || item?.nome;
        let lat = item?.lat ?? item?.latitude;
        let lon = item?.lon ?? item?.longitude;

        if (!nome && item && typeof item === 'object') {
          const keys = Object.keys(item);
          const bairroKey = keys.find(k => k.toLowerCase().includes('bairro') || k.toLowerCase().includes('regiao') || k.toLowerCase().includes('nome'));
          const latKey = keys.find(k => k.toLowerCase().includes('lat'));
          const lonKey = keys.find(k => k.toLowerCase().includes('lon'));
          if (bairroKey) nome = item[bairroKey];
          if (latKey && lat === undefined) lat = item[latKey];
          if (lonKey && lon === undefined) lon = item[lonKey];
        }

        if (!nome) continue;

        const exists = regioes.some(r => r.regiao.toLowerCase() === String(nome).trim().toLowerCase());
        if (exists) {
          skippedCount++;
          continue;
        }

        const numLat = lat != null ? Number(lat) : null;
        const numLon = lon != null ? Number(lon) : null;

        const payload: Record<string, unknown> = {
          cliente_id: clienteId,
          regiao: String(nome).trim(),
          updated_at: new Date().toISOString(),
        };

        if (numLat !== null && !isNaN(numLat)) payload.latitude = numLat;
        if (numLon !== null && !isNaN(numLon)) payload.longitude = numLon;

        newRegioes.push(payload);
      }

      // Geocoding em lote via Edge Function (paralelo no servidor)
      const semCoords = newRegioes.filter(r => !r.latitude || !r.longitude);
      let geocodedCount = 0;
      if (semCoords.length > 0) {
        toast.info(`Buscando coordenadas para ${semCoords.length} região(ões)...`);
        try {
          const { data, error: geoError } = await supabase.functions.invoke('geocode-regioes', {
            body: {
              nomes: semCoords.map(r => String(r.regiao)),
              cidade: clienteAtivo?.cidade || clienteAtivo?.nome || '',
            },
          });
          if (!geoError && data?.results) {
            const coordMap = new Map<string, { latitude: number; longitude: number }>(
              (data.results as { nome: string; latitude: number | null; longitude: number | null }[])
                .filter(r => r.latitude !== null)
                .map(r => [r.nome, { latitude: r.latitude!, longitude: r.longitude! }])
            );
            for (const reg of semCoords) {
              const coords = coordMap.get(String(reg.regiao));
              if (coords) {
                reg.latitude = coords.latitude;
                reg.longitude = coords.longitude;
                geocodedCount++;
              }
            }
          }
        } catch { /* geocoding é best-effort — segue sem coordenadas */ }
      }

      if (newRegioes.length > 0) {
        await api.regioes.bulkInsert(newRegioes as Parameters<typeof api.regioes.bulkInsert>[0]);
        insertedCount += newRegioes.length;
      }

      if (insertedCount > 0) {
        const parts = [`${insertedCount} regiões importadas`];
        if (geocodedCount > 0) parts.push(`${geocodedCount} geocodificada(s)`);
        if (skippedCount > 0) parts.push(`${skippedCount} ignorada(s)`);
        toast.success(parts.join(', ') + '!');
        queryClient.invalidateQueries({ queryKey: ['admin_regioes', clienteId] });
      } else if (skippedCount > 0 && lastError === null) {
        toast.info(`Nenhuma região nova. Todas as ${skippedCount} já existiam.`);
      } else {
        const firstStr = items.length > 0 ? JSON.stringify(items[0]).slice(0, 50) : '';
        toast.error(`Falha: ${lastError || 'Nenhum dado válido'}. Lido: ${firstStr}`);
      }
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  const handleDownloadTemplate = () => {
    const template = [
      { bairro: "Centro", lat: -21.723190, lon: -52.262257 },
      { bairro: "Jardim Primavera", lat: -21.246472, lon: -52.033759 },
      { bairro: "Jardim Alvorada", lat: null, lon: null }
    ];
    const blob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'modelo_importacao_regioes.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const filtered = regioes.filter(
    (r) => r.regiao.toLowerCase().includes(search.toLowerCase()),
  );

  const { page, totalPages, paginated, goTo, next, prev, reset, total } = usePagination(filtered);

  if (showForm) {
    return (
      <div className="space-y-4 lg:space-y-4 animate-fade-in">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={closeForm}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h2 className="text-lg font-semibold">{editing ? 'Editar Região' : 'Nova Região'}</h2>
            <p className="text-sm text-muted-foreground">
              {editing ? 'Atualize os dados da região.' : 'Preencha os dados para cadastrar uma nova região.'}
            </p>
          </div>
        </div>

        <Card className="rounded-sm border-2 border-cardBorder shadow-lg shadow-black/8 dark:shadow-black/20">
          <CardContent className="p-6">
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label>Região *</Label>
                <div className="flex gap-2">
                  <Input
                    value={form.regiao}
                    onChange={(e) => setForm((p) => ({ ...p, regiao: e.target.value }))}
                    onBlur={handleRegiaoBlur}
                    placeholder="Ex: Zona Norte"
                    maxLength={200}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => handleGeocode()}
                    disabled={geocoding || !form.regiao.trim()}
                    title="Buscar coordenadas automaticamente"
                  >
                    {geocoding ? <Loader2 className="w-4 h-4 animate-spin" /> : <LocateFixed className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Latitude</Label>
                  <Input
                    type="number"
                    step="any"
                    value={form.latitude}
                    onChange={(e) => setForm((p) => ({ ...p, latitude: e.target.value }))}
                    placeholder="Ex: -23.5505"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Longitude</Label>
                  <Input
                    type="number"
                    step="any"
                    value={form.longitude}
                    onChange={(e) => setForm((p) => ({ ...p, longitude: e.target.value }))}
                    placeholder="Ex: -46.6333"
                  />
                </div>
              </div>

              {/* Mapa para desenhar polígono */}
              <div className="space-y-2">
                <Label>Área (Polígono)</Label>
                <Suspense fallback={<div className="h-[300px] rounded-lg bg-muted animate-pulse" />}>
                  <DrawPolygonMap
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    value={form.area as any}
                    onChange={(geojson) => setForm((p) => ({ ...p, area: geojson as unknown as Record<string, unknown> | null }))}
                    onMapClick={(lat, lng) => {
                      setForm((p) => ({ ...p, latitude: lat.toFixed(6), longitude: lng.toFixed(6) }));
                      toast.success(`Coordenadas atualizadas: ${lat.toFixed(6)}, ${lng.toFixed(6)}`);
                    }}
                    center={
                      form.latitude && form.longitude
                        ? [parseFloat(form.latitude), parseFloat(form.longitude)]
                        : clienteAtivo?.latitude_centro && clienteAtivo?.longitude_centro
                          ? [clienteAtivo.latitude_centro, clienteAtivo.longitude_centro]
                          : undefined
                    }
                    className="h-[300px] rounded-lg"
                  />
                </Suspense>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
              <Button variant="outline" onClick={closeForm}>Cancelar</Button>
              <Button onClick={handleSave} disabled={saveMutation.isPending}>
                {saveMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                {editing ? 'Salvar' : 'Cadastrar'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 lg:space-y-4">
      <ConfirmDialog
        open={!!confirmDialog}
        onOpenChange={(open) => { if (!open) setConfirmDialog(null); }}
        title={confirmDialog?.title ?? ''}
        description={confirmDialog?.description ?? ''}
        onConfirm={() => { confirmDialog?.onConfirm(); setConfirmDialog(null); }}
      />
      <AdminPageHeader
        title="Regiões"
        description="Cadastro de regiões vinculadas aos clientes."
        icon={MapPin}
      />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome da região..."
            className="pl-9"
            value={search}
            onChange={(e) => { setSearch(e.target.value); reset(); }}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={handleDownloadTemplate}
          >
            <Download className="w-3.5 h-3.5" />
            Modelo JSON
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs"
            disabled={importing}
            onClick={() => document.getElementById('regioes-json-import')?.click()}
          >
            {importing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Importar JSON
          </Button>
          <input id="regioes-json-import" type="file" accept=".json" className="hidden" onChange={handleImportJson} />
          <Button onClick={openCreate} className="w-full sm:w-auto gap-2">
            <Plus className="w-4 h-4" />
            Nova Região
          </Button>
        </div>
      </div>

      <Card className="rounded-sm border-2 border-cardBorder shadow-lg shadow-black/8 dark:shadow-black/20 overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* Mobile/Tablet cards */}
              <div className="md:hidden p-3 space-y-3">
                {paginated.map((r) => (
                  <MobileListCard
                    key={r.id}
                    title={r.regiao}
                    fields={[
                      { label: 'Latitude', value: r.latitude?.toFixed(6) ?? '—' },
                      { label: 'Longitude', value: r.longitude?.toFixed(6) ?? '—' },
                    ]}
                    onEdit={() => openEdit(r)}
                    onDelete={isAdmin ? () => handleDelete(r) : undefined}
                  />
                ))}
                {filtered.length === 0 && (
                  <p className="text-center py-12 text-muted-foreground text-sm">Nenhuma região encontrada</p>
                )}
              </div>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Região</TableHead>
                      <TableHead>Latitude</TableHead>
                      <TableHead>Longitude</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginated.map((r) => (
                      <TableRow key={r.id} className="group cursor-pointer hover:bg-muted/50" onClick={() => openEdit(r)}>
                        <TableCell className="font-medium">{r.regiao}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{r.latitude?.toFixed(6) ?? '—'}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{r.longitude?.toFixed(6) ?? '—'}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); openEdit(r); }}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                            {isAdmin && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => { e.stopPropagation(); handleDelete(r); }}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filtered.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                          Nenhuma região encontrada
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
          <TablePagination page={page} totalPages={totalPages} total={total} onGoTo={goTo} onNext={next} onPrev={prev} />
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminRegioes;
