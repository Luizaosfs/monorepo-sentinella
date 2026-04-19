import { useState, Suspense, lazy } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/services/api';
import { tokenStore } from '@sentinella/api-client';
import { useClienteAtivo } from '@/hooks/useClienteAtivo';
import { usePagination } from '@/hooks/usePagination';
import TablePagination from '@/components/TablePagination';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, Building2, Plus, Pencil, Trash2, Search, MapPin, Pentagon, ArrowLeft, LocateFixed, CreditCard, AlertTriangle, Users } from 'lucide-react';
import { Cliente } from '@/types/database';
import { validateSenhaForte } from '@/lib/senhaValidacao';
import { usePlanos, useUpdateClientePlan, useBillingResumo } from '@/hooks/queries/useBilling';
import AdminPageHeader from '@/components/AdminPageHeader';
import MobileListCard from '@/components/admin/MobileListCard';
import ConfirmDialog from '@/components/admin/ConfirmDialog';
import { seedDefaultRiskPolicy } from '@/lib/seedDefaultRiskPolicy';
import { seedDefaultDroneRiskConfig } from '@/lib/seedDefaultDroneRiskConfig';
import { seedDefaultSlaConfig } from '@/lib/seedDefaultSlaConfig';
import { seedDefaultPlanoAcaoCatalogo } from '@/lib/seedDefaultPlanoAcaoCatalogo';
import { seedDefaultSlaFeriados } from '@/lib/seedDefaultSlaFeriados';
import { type PlanejamentoGeoJSON } from '@/components/map/InspectionLeafletMap';
import { forwardGeocode } from '@/lib/geo';

const DrawPolygonMap = lazy(() => import('@/components/map/DrawPolygonMap'));

const UF_OPTIONS = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG',
  'PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO',
];

const emptySupervisor = { nome: '', email: '', senha: '' };

const emptyCliente = {
  nome: '',
  slug: '',
  cnpj: '',
  contato_email: '',
  contato_telefone: '',
  endereco: '',
  bairro: '',
  cidade: '',
  estado: '',
  cep: '',
  uf: '',
  ibge_municipio: '',
  latitude_centro: '',
  longitude_centro: '',
  bounds: '',
  area: null as PlanejamentoGeoJSON | null,
  ativo: true,
  surto_ativo: false,
};

const AdminClientes = () => {
  const { isAdmin } = useAuth();
  const { clienteId } = useClienteAtivo();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Cliente | null>(null);
  const [form, setForm] = useState(emptyCliente);
  const [supervisorForm, setSupervisorForm] = useState(emptySupervisor);
  const [geocoding, setGeocoding] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{ title: string; description: string; onConfirm: () => void } | null>(null);
  const [planoSelecionado, setPlanoSelecionado] = useState<string>('');
  // Credenciais do supervisor recém-criado (exibir uma vez, somente em sucesso completo)
  const [supervisorCriado, setSupervisorCriado] = useState<{ nome: string; email: string; senha: string } | null>(null);

  const { data: planos = [] } = usePlanos();
  const { data: billingResumo = [] } = useBillingResumo();
  const updatePlanMutation = useUpdateClientePlan();

  const { data: clientes = [], isLoading: loading } = useQuery({
    queryKey: ['admin_clientes', clienteId],
    queryFn: async () => {
      // QW-10A: filtrar clientes com soft delete (deleted_at IS NULL)
      const all = await api.clientes.listAll();
      const active = all.filter((c: Cliente) => !c.deleted_at);
      return clienteId ? active.filter((c: Cliente) => c.id === clienteId) : active;
    },
    staleTime: 0,
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: {
      data: Record<string, unknown>;
      id?: string;
      supervisor?: { nome: string; email: string; senha: string };
    }) => {
      if (payload.id) {
        await api.clientes.update(payload.id, payload.data as Partial<Cliente>);
        return { isNew: false, clienteNome: '', supervisorCredenciais: null as typeof emptySupervisor | null };
      }

      // ── 1. Criar cliente ──────────────────────────────────────────────────
      const newCliente = await api.clientes.create(payload.data as Omit<Cliente, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>);

      // ── 2. Criar supervisor inicial (obrigatório) ─────────────────────────
      // Falha aqui → rollback (soft-delete do cliente) → throw → onError
      try {
        if (!tokenStore.getAccessToken()) throw new Error('Sessão expirada. Faça login novamente.');
        await api.usuarios.create({
          nome: payload.supervisor!.nome.trim(),
          email: payload.supervisor!.email.trim().toLowerCase(),
          senha: payload.supervisor!.senha,
          cliente_id: newCliente.id,
          papel: 'supervisor',
        });
      } catch (supervisorErr) {
        // Rollback: soft-delete do cliente recém-criado para não deixar órfão
        await api.clientes.update(newCliente.id, { ativo: false, deleted_at: new Date().toISOString() } as never);
        throw new Error(
          `Falha ao criar supervisor: ${supervisorErr instanceof Error ? supervisorErr.message : String(supervisorErr)}. ` +
          `O cliente foi removido automaticamente.`
        );
      }

      // ── 3. Seeds de configuração (após supervisor — fire-and-forget) ───────
      await Promise.all([
        seedDefaultRiskPolicy(newCliente.id),
        seedDefaultDroneRiskConfig(newCliente.id),
        seedDefaultSlaConfig(newCliente.id),
        seedDefaultPlanoAcaoCatalogo(newCliente.id),
        seedDefaultSlaFeriados(newCliente.id),
      ]);

      return {
        isNew: true,
        clienteNome: String(payload.data.nome),
        supervisorCredenciais: payload.supervisor ?? null,
      };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['admin_clientes', clienteId] });
      setShowForm(false);
      if (!result.isNew) {
        toast.success('Cliente atualizado');
        return;
      }
      if (result.supervisorCredenciais) setSupervisorCriado(result.supervisorCredenciais);
      toast.success(`Cliente "${result.clienteNome}" e supervisor criados com sucesso!`);
    },
    onError: (err: unknown) => toast.error(err instanceof Error ? err.message : 'Erro ao salvar'),
  });

  const deleteMutation = useMutation({
    // QW-10A: soft delete — DELETE físico bloqueado por trigger no banco
    mutationFn: async (id: string) => {
      await api.clientes.update(id, { ativo: false, deleted_at: new Date().toISOString() } as never);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_clientes', clienteId] });
      toast.success('Cliente desativado');
    },
    onError: (err: unknown) => toast.error(err instanceof Error ? err.message : 'Erro ao desativar'),
  });

  const handleBuscarCoordenadas = async () => {
    const query = [form.cidade, form.estado].filter(Boolean).join(', ');
    if (!query) {
      toast.error('Preencha ao menos a cidade para buscar coordenadas.');
      return;
    }
    setGeocoding(true);
    try {
      const result = await forwardGeocode(query);
      if (!result) {
        toast.error('Coordenadas não encontradas para o endereço informado.');
        return;
      }
      setForm((p) => ({
        ...p,
        latitude_centro: result.lat.toString(),
        longitude_centro: result.lng.toString(),
      }));
      toast.success(`Coordenadas encontradas: ${result.lat.toFixed(6)}, ${result.lng.toFixed(6)}`);
    } catch {
      toast.error('Erro ao buscar coordenadas.');
    } finally {
      setGeocoding(false);
    }
  };



  const openCreate = () => {
    setEditing(null);
    setForm(emptyCliente);
    setSupervisorForm(emptySupervisor);
    setShowForm(true);
  };

  const openEdit = (c: Cliente) => {
    setEditing(c);
    setForm({
      nome: c.nome,
      slug: c.slug,
      cnpj: c.cnpj || '',
      contato_email: c.contato_email || '',
      contato_telefone: c.contato_telefone || '',
      endereco: c.endereco || '',
      bairro: c.bairro || '',
      cidade: c.cidade || '',
      estado: c.estado || '',
      cep: c.cep || '',
      uf: c.uf || '',
      ibge_municipio: c.ibge_municipio || '',
      latitude_centro: c.latitude_centro?.toString() || '',
      longitude_centro: c.longitude_centro?.toString() || '',
      bounds: c.bounds ? JSON.stringify(c.bounds, null, 2) : '',
      area: (c.area as PlanejamentoGeoJSON) || null,
      ativo: c.ativo,
      surto_ativo: c.surto_ativo ?? false,
    });
    const resumo = billingResumo.find((r) => r.cliente_id === c.id);
    setPlanoSelecionado(resumo?.plano_id ?? '');
    setShowForm(true);
  };

  const handleSave = () => {
    if (!form.nome.trim() || !form.slug.trim()) {
      toast.error('Nome e slug são obrigatórios');
      return;
    }

    // ── Validação do supervisor inicial (obrigatório na criação) ──────────
    if (!editing) {
      if (!supervisorForm.nome.trim() || !supervisorForm.email.trim()) {
        toast.error('Nome e email do supervisor inicial são obrigatórios');
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supervisorForm.email.trim())) {
        toast.error('Email do supervisor inválido');
        return;
      }
      const senhaResult = validateSenhaForte(supervisorForm.senha);
      if (!senhaResult.valid) {
        toast.error(`Supervisor — ${senhaResult.error}`);
        return;
      }
    }

    let parsedBounds = null;
    if (form.bounds.trim()) {
      try { parsedBounds = JSON.parse(form.bounds.trim()); }
      catch { toast.error('Bounds deve ser um JSON válido'); return; }
    }
    const slug = form.slug.trim().toLowerCase().replace(/\s+/g, '-');
    // Validar unicidade de slug usando a lista já carregada
    if (!editing && clientes.some((c) => c.slug === slug)) {
      toast.error(`O slug "${slug}" já está em uso. Escolha um identificador único.`);
      return;
    }
    const ibge = form.ibge_municipio.trim().replace(/\D/g, '');
    if (ibge && ibge.length !== 7) {
      toast.error('Código IBGE deve ter exatamente 7 dígitos');
      return;
    }
    const payload = {
      nome: form.nome.trim(), slug,
      cnpj: form.cnpj.trim() || null,
      contato_email: form.contato_email.trim() || null,
      contato_telefone: form.contato_telefone.trim() || null,
      endereco: form.endereco.trim() || null,
      bairro: form.bairro.trim() || null,
      cidade: form.cidade.trim() || null,
      estado: form.estado.trim() || null,
      cep: form.cep.trim() || null,
      uf: form.uf.trim() || null,
      ibge_municipio: ibge || null,
      latitude_centro: form.latitude_centro ? parseFloat(form.latitude_centro) : null,
      longitude_centro: form.longitude_centro ? parseFloat(form.longitude_centro) : null,
      bounds: parsedBounds,
      area: form.area,
      ativo: form.ativo,
      surto_ativo: form.surto_ativo,
    };
    saveMutation.mutate({
      data: payload,
      ...(editing ? { id: editing.id } : { supervisor: supervisorForm }),
    });
    if (editing && planoSelecionado) {
      updatePlanMutation.mutate({ clienteId: editing.id, payload: { plano_id: planoSelecionado } });
    }
  };

  const handleDelete = (c: Cliente) => {
    setConfirmDialog({
      title: 'Excluir cliente',
      description: `Excluir "${c.nome}"? Isso pode afetar usuários e levantamentos vinculados. Esta ação não pode ser desfeita.`,
      onConfirm: () => deleteMutation.mutate(c.id),
    });
  };

  const filtered = clientes.filter((c) =>
    c.nome.toLowerCase().includes(search.toLowerCase()) ||
    c.slug.toLowerCase().includes(search.toLowerCase()) ||
    (c.cnpj || '').includes(search)
  );

  const { page, totalPages, paginated, goTo, next, prev, reset, total } = usePagination(filtered);

  if (showForm) {
    return (
      <div className="space-y-2 animate-fade-in">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setShowForm(false)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h2 className="text-lg font-semibold">{editing ? 'Editar Cliente' : 'Onboarding — Nova Prefeitura'}</h2>
            <p className="text-xs text-muted-foreground">
              {editing
                ? 'Atualize os dados do cliente.'
                : 'Preencha os dados da prefeitura e crie o supervisor inicial (administrador local).'}
            </p>
          </div>
        </div>

        <Card className="rounded-sm border-2 border-cardBorder shadow-lg shadow-black/8 dark:shadow-black/20">
          <CardContent className="p-3 sm:p-4">
            <div className="space-y-2">
              {/* Dados básicos */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Dados Básicos</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                  <div className="space-y-0.5">
                    <Label className="text-xs">Nome *</Label>
                    <Input value={form.nome} onChange={(e) => setForm((p) => ({ ...p, nome: e.target.value }))} placeholder="Nome do cliente" maxLength={100} />
                  </div>
                  <div className="space-y-0.5">
                    <Label className="text-xs">Slug *</Label>
                    <Input value={form.slug} onChange={(e) => setForm((p) => ({ ...p, slug: e.target.value }))} placeholder="slug-unico" maxLength={50} />
                  </div>
                  <div className="space-y-0.5">
                    <Label className="text-xs">CNPJ</Label>
                    <Input value={form.cnpj} onChange={(e) => setForm((p) => ({ ...p, cnpj: e.target.value }))} placeholder="00.000.000/0000-00" maxLength={18} />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Endereço */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" /> Endereço
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  <div className="sm:col-span-2 space-y-0.5">
                    <Label className="text-xs">Endereço (Rua / Logradouro)</Label>
                    <Input value={form.endereco} onChange={(e) => setForm((p) => ({ ...p, endereco: e.target.value }))} placeholder="Rua Exemplo, 123" maxLength={255} />
                  </div>
                  <div className="space-y-0.5">
                    <Label className="text-xs">Bairro</Label>
                    <Input value={form.bairro} onChange={(e) => setForm((p) => ({ ...p, bairro: e.target.value }))} placeholder="Centro" maxLength={100} />
                  </div>
                  <div className="space-y-0.5">
                    <Label className="text-xs">Cidade</Label>
                    <Input value={form.cidade} onChange={(e) => setForm((p) => ({ ...p, cidade: e.target.value }))} placeholder="São Paulo" maxLength={100} />
                  </div>
                  <div className="space-y-0.5">
                    <Label className="text-xs">Estado</Label>
                    <Input value={form.estado} onChange={(e) => setForm((p) => ({ ...p, estado: e.target.value }))} placeholder="São Paulo" maxLength={50} />
                  </div>
                  <div className="space-y-0.5">
                    <Label className="text-xs">CEP</Label>
                    <Input value={form.cep} onChange={(e) => setForm((p) => ({ ...p, cep: e.target.value }))} placeholder="01001-000" maxLength={10} />
                  </div>
                  <div className="space-y-0.5">
                    <Label className="text-xs">UF <span className="text-amber-600">(CNES)</span></Label>
                    <Select value={form.uf} onValueChange={(v) => setForm((p) => ({ ...p, uf: v }))}>
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {UF_OPTIONS.map((uf) => (
                          <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-0.5">
                    <Label className="text-xs">Código IBGE <span className="text-amber-600">(CNES)</span></Label>
                    <Input
                      value={form.ibge_municipio}
                      onChange={(e) => setForm((p) => ({ ...p, ibge_municipio: e.target.value.replace(/\D/g, '').slice(0, 7) }))}
                      placeholder="5003207"
                      maxLength={7}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Contato */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Contato</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  <div className="space-y-0.5">
                    <Label className="text-xs">Email</Label>
                    <Input type="email" value={form.contato_email} onChange={(e) => setForm((p) => ({ ...p, contato_email: e.target.value }))} placeholder="contato@empresa.com" maxLength={255} />
                  </div>
                  <div className="space-y-0.5">
                    <Label className="text-xs">Telefone</Label>
                    <Input value={form.contato_telefone} onChange={(e) => setForm((p) => ({ ...p, contato_telefone: e.target.value }))} placeholder="(11) 99999-9999" maxLength={20} />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Geolocalização */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <LocateFixed className="w-3.5 h-3.5" /> Geolocalização
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  <div className="space-y-0.5">
                    <Label className="text-xs">Latitude Centro</Label>
                    <Input type="number" step="any" value={form.latitude_centro} onChange={(e) => setForm((p) => ({ ...p, latitude_centro: e.target.value }))} placeholder="-23.5505" />
                  </div>
                  <div className="space-y-0.5">
                    <Label className="text-xs">Longitude Centro</Label>
                    <Input type="number" step="any" value={form.longitude_centro} onChange={(e) => setForm((p) => ({ ...p, longitude_centro: e.target.value }))} placeholder="-46.6333" />
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-1.5 gap-1.5 h-8 text-xs"
                  disabled={geocoding}
                  onClick={handleBuscarCoordenadas}
                >
                  {geocoding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LocateFixed className="w-3.5 h-3.5" />}
                  Buscar Lat/Lng pelo endereço
                </Button>
                <div className="mt-1.5 space-y-0.5">
                  <Label className="text-xs">Bounds (JSON)</Label>
                  <Textarea value={form.bounds} onChange={(e) => setForm((p) => ({ ...p, bounds: e.target.value }))} placeholder='{"north": -23.5, "south": -23.6, "east": -46.5, "west": -46.7}' rows={2} className="font-mono text-xs" />
                </div>
              </div>

              <Separator />

              {/* Área Urbana */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <Pentagon className="w-3.5 h-3.5" /> Área Urbana
                </p>
                <Suspense fallback={<div className="h-[280px] rounded-lg border border-border flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>}>
                  <DrawPolygonMap
                    value={form.area}
                    onChange={(geojson) => setForm((p) => ({ ...p, area: geojson as PlanejamentoGeoJSON }))}
                    center={
                      form.latitude_centro && form.longitude_centro
                        ? [parseFloat(form.latitude_centro), parseFloat(form.longitude_centro)]
                        : undefined
                    }
                    mapClassName="h-[280px]"
                  />
                </Suspense>
              </div>

              <Separator />

              {/* Status */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <Switch checked={form.ativo} onCheckedChange={(v) => setForm((p) => ({ ...p, ativo: v }))} />
                  <Label className="text-xs">Cliente ativo</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={form.surto_ativo}
                    onCheckedChange={(v) => setForm((p) => ({ ...p, surto_ativo: v }))}
                    className="data-[state=checked]:bg-destructive"
                  />
                  <Label className="text-xs flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 text-destructive" />
                    Surto ativo — bypassa limites de levantamentos e vistorias
                  </Label>
                </div>
              </div>

              {editing && (
                <>
                  <Separator />
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5" /> Plano SaaS
                    </p>
                    <div className="max-w-xs space-y-0.5">
                      <Label className="text-xs">Plano contratado</Label>
                      <Select value={planoSelecionado} onValueChange={setPlanoSelecionado}>
                        <SelectTrigger className="h-9 text-sm">
                          <SelectValue placeholder="Selecione o plano" />
                        </SelectTrigger>
                        <SelectContent>
                          {planos.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.nome}{p.preco_mensal ? ` — R$ ${p.preco_mensal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : ' — Customizado'}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </>
              )}
            </div>

              {/* Supervisor Inicial — somente na criação */}
              {!editing && (
                <>
                  <Separator />
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5" /> Supervisor Inicial (obrigatório)
                    </p>
                    <p className="text-xs text-muted-foreground mb-2">
                      Este usuário será o administrador local da prefeitura. Poderá gerenciar agentes e acompanhar a operação.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      <div className="space-y-0.5">
                        <Label className="text-xs">Nome *</Label>
                        <Input
                          value={supervisorForm.nome}
                          onChange={(e) => setSupervisorForm((p) => ({ ...p, nome: e.target.value }))}
                          placeholder="Nome completo"
                          maxLength={100}
                        />
                      </div>
                      <div className="space-y-0.5">
                        <Label className="text-xs">Email *</Label>
                        <Input
                          type="email"
                          value={supervisorForm.email}
                          onChange={(e) => setSupervisorForm((p) => ({ ...p, email: e.target.value }))}
                          placeholder="supervisor@prefeitura.gov.br"
                          maxLength={255}
                        />
                      </div>
                      <div className="sm:col-span-2 space-y-0.5">
                        <Label className="text-xs">Senha temporária * (mín. 8 chars, maiúscula, número e especial)</Label>
                        <Input
                          type="password"
                          value={supervisorForm.senha}
                          onChange={(e) => setSupervisorForm((p) => ({ ...p, senha: e.target.value }))}
                          placeholder="Senha provisória — o supervisor poderá alterar no primeiro acesso"
                          minLength={8}
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}

            <div className="flex justify-end gap-2 mt-3 pt-2 border-t">
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={saveMutation.isPending}>
                {saveMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {editing ? 'Salvar' : 'Criar Prefeitura e Supervisor'}
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
      <AdminPageHeader title="Clientes" description="Gerencie os clientes cadastrados no sistema." icon={Building2} />

      {/* ── Credenciais do supervisor recém-criado (exibir uma vez, somente em sucesso completo) ── */}
      {supervisorCriado && (
        <div className="rounded-md border border-green-300 bg-green-50 dark:bg-green-950/30 dark:border-green-800 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-green-800 dark:text-green-300">
              Supervisor criado — anote as credenciais antes de fechar
            </p>
            <button onClick={() => setSupervisorCriado(null)} className="text-green-700 dark:text-green-400 hover:opacity-70 text-xs underline">
              Fechar
            </button>
          </div>
          <div className="text-sm text-green-900 dark:text-green-200 space-y-1">
            <p><span className="font-medium">Nome:</span> {supervisorCriado.nome}</p>
            <p><span className="font-medium">E-mail:</span> {supervisorCriado.email}</p>
            <p className="flex items-center gap-2">
              <span className="font-medium">Senha:</span>
              <code className="bg-green-100 dark:bg-green-900 px-2 py-0.5 rounded font-mono">{supervisorCriado.senha}</code>
              <button
                onClick={() => { navigator.clipboard.writeText(supervisorCriado!.senha); toast.success('Senha copiada'); }}
                className="text-xs underline text-green-700 dark:text-green-400 hover:opacity-70"
              >copiar</button>
            </p>
          </div>
        </div>
      )}
      <div className="space-y-3 lg:space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar por nome, slug ou CNPJ..." className="pl-9" value={search} onChange={(e) => { setSearch(e.target.value); reset(); }} />
          </div>
          <Button onClick={openCreate} className="w-full sm:w-auto gap-2">
            <Plus className="w-4 h-4" /> Novo Cliente
          </Button>
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
                  {paginated.map((c) => (
                    <MobileListCard
                      key={c.id}
                      title={c.nome}
                      badges={
                        <>
                          <Badge variant={c.ativo ? 'default' : 'secondary'}>
                            {c.ativo ? 'Ativo' : 'Inativo'}
                          </Badge>
                          {c.surto_ativo && (
                            <Badge variant="destructive" className="gap-0.5">
                              <AlertTriangle className="w-3 h-3" /> Surto
                            </Badge>
                          )}
                        </>
                      }
                      fields={[
                        { label: 'ID', value: <span className="font-mono text-xs">{c.id.slice(0, 8)}…</span> },
                        { label: 'Slug', value: <span className="font-mono">{c.slug}</span> },
                        { label: 'Cidade/UF', value: [c.cidade, c.estado].filter(Boolean).join(' / ') || null },
                        { label: 'CNPJ', value: c.cnpj },
                        { label: 'Email', value: c.contato_email },
                        { label: 'Área', value: c.area ? <span className="text-primary flex items-center gap-1"><Pentagon className="w-3 h-3" />Definida</span> : null },
                      ]}
                      onEdit={() => openEdit(c)}
                      onDelete={isAdmin ? () => handleDelete(c) : undefined}
                    />
                  ))}
                  {filtered.length === 0 && (
                    <p className="text-center py-12 text-muted-foreground text-sm">Nenhum cliente encontrado</p>
                  )}
                </div>
                {/* Desktop table */}
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                     <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Cidade / Estado</TableHead>
                        <TableHead>CNPJ</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Coordenadas</TableHead>
                        <TableHead>Área</TableHead>
                        <TableHead>Plano</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginated.map((c) => (
                        <TableRow key={c.id} className="group cursor-pointer hover:bg-muted/50" onClick={() => openEdit(c)}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-1.5">
                              {c.nome}
                              {c.surto_ativo && (
                                <Badge variant="destructive" className="text-xs gap-0.5 py-0 px-1">
                                  <AlertTriangle className="w-2.5 h-2.5" /> Surto
                                </Badge>
                              )}
                            </div>
                            <span className="block text-xs text-muted-foreground font-mono">{c.id.slice(0, 8)}…</span>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">{[c.cidade, c.estado].filter(Boolean).join(' / ') || '—'}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">{c.cnpj || '—'}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">{c.contato_email || '—'}</TableCell>
                          <TableCell className="text-muted-foreground text-xs">
                            {c.latitude_centro && c.longitude_centro ? (
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {c.latitude_centro.toFixed(4)}, {c.longitude_centro.toFixed(4)}
                              </span>
                            ) : '—'}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-xs">
                            {c.area ? (
                              <span className="flex items-center gap-1 text-primary">
                                <Pentagon className="w-3 h-3" /> Definida
                              </span>
                            ) : '—'}
                          </TableCell>
                          <TableCell>
                            {(() => {
                              const resumo = billingResumo.find((r) => r.cliente_id === c.id);
                              if (!resumo?.plano_nome) return <span className="text-muted-foreground text-xs">—</span>;
                              return (
                                <Badge variant="outline" className="text-xs gap-1">
                                  <CreditCard className="w-3 h-3" />
                                  {resumo.plano_nome}
                                </Badge>
                              );
                            })()}
                          </TableCell>
                          <TableCell>
                            <Badge variant={c.ativo ? 'default' : 'secondary'}>
                              {c.ativo ? 'Ativo' : 'Inativo'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-1 justify-end">
                              <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); openEdit(c); }}>
                                <Pencil className="w-4 h-4" />
                              </Button>
                              {isAdmin && (
                                <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleDelete(c); }} className="text-destructive hover:text-destructive">
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {filtered.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                            Nenhum cliente encontrado
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
    </div>
  );
};

export default AdminClientes;
