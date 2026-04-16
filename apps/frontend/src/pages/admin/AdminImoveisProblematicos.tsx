import { useState } from 'react';
import { useClienteAtivo } from '@/hooks/useClienteAtivo';
import { useImoveisProblematicos } from '@/hooks/queries/useImoveisProblematicos';
import { useImoveis } from '@/hooks/queries/useImoveis';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { toast } from 'sonner';
import AdminPageHeader from '@/components/AdminPageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Plane, Bell, Search, Home, Dog, ShieldOff, Wrench, MapPin, FileText, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { gerarNotificacaoFormalPdf } from '@/lib/notificacaoFormalPdf';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { Imovel, ImovelHistoricoAcesso } from '@/types/database';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

function rowColor(r: ImovelHistoricoAcesso) {
  if (r.requer_notificacao_formal || r.pct_sem_acesso > 80) return 'bg-rose-50/60 hover:bg-rose-50 dark:bg-rose-950/20';
  if (r.pct_sem_acesso > 50) return 'bg-amber-50/60 hover:bg-amber-50 dark:bg-amber-950/20';
  return 'hover:bg-muted/40';
}

function toHistoricoFromImovel(imovel: Imovel): ImovelHistoricoAcesso {
  return {
    imovel_id: imovel.id,
    cliente_id: imovel.cliente_id,
    logradouro: imovel.logradouro,
    numero: imovel.numero,
    bairro: imovel.bairro,
    quarteirao: imovel.quarteirao,
    proprietario_ausente: imovel.proprietario_ausente,
    tipo_ausencia: imovel.tipo_ausencia,
    tem_animal_agressivo: imovel.tem_animal_agressivo,
    historico_recusa: imovel.historico_recusa,
    prioridade_drone: imovel.prioridade_drone,
    tem_calha: imovel.tem_calha,
    calha_acessivel: imovel.calha_acessivel,
    notificacao_formal_em: imovel.notificacao_formal_em,
    total_visitas: 0,
    total_sem_acesso: 0,
    pct_sem_acesso: 0,
    ultima_visita_com_acesso: null,
    ultima_tentativa: null,
    requer_notificacao_formal: false,
  };
}

export default function AdminImoveisProblematicos() {
  const { clienteId } = useClienteAtivo();
  const { usuario } = useAuth();
  const queryClient = useQueryClient();
  const { data: imoveis = [], isLoading, error } = useImoveisProblematicos(clienteId);
  const { data: imoveisBase = [] } = useImoveis(clienteId);

  const [search, setSearch] = useState('');
  const [filtroDrone, setFiltroDrone] = useState<'todos' | 'drone' | 'nao_drone'>('todos');
  const [filtroNotif, setFiltroNotif] = useState(false);
  const [filtroProblematicos, setFiltroProblematicos] = useState(false);
  const [editingImovel, setEditingImovel] = useState<ImovelHistoricoAcesso | null>(null);
  const [editForm, setEditForm] = useState({
    logradouro: '',
    numero: '',
    complemento: '',
    bairro: '',
    quarteirao: '',
    latitude: '',
    longitude: '',
    proprietario_ausente: false,
    tipo_ausencia: '' as string,
    contato_proprietario: '',
    tem_animal_agressivo: false,
    tem_calha: false,
    calha_acessivel: true,
  });

  const droneToggle = useMutation({
    mutationFn: ({ id, valor }: { id: string; valor: boolean }) =>
      api.imoveis.marcarPrioridadeDrone(id, valor),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['imoveis_problematicos'] });
      toast.success('Prioridade de drone atualizada.');
    },
  });

  const gerarNotificacao = useMutation({
    mutationFn: async (row: ImovelHistoricoAcesso) => {
      const protocolo = await api.notificacaoFormal.gerarProtocolo(clienteId!);
      gerarNotificacaoFormalPdf({
        imovel: {
          logradouro: row.logradouro ?? '',
          numero: row.numero,
          bairro: row.bairro ?? '',
          quarteirao: row.quarteirao,
          tipo_imovel: row.tipo_imovel ?? 'residencial',
        },
        cliente: { nome: '', codigo_ibge: null },
        numero_protocolo: protocolo,
        agente_nome: usuario?.nome ?? 'Agente',
        total_tentativas: row.total_sem_acesso ?? 0,
        dias_periodo: 90,
      });
      await api.imoveis.update(row.imovel_id, { notificacao_formal_em: new Date().toISOString() });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['imoveis_problematicos'] });
      toast.success('Notificação gerada e registrada.');
    },
    onError: () => toast.error('Erro ao gerar notificação'),
  });

  const perfilUpdate = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: typeof editForm }) =>
      api.imoveis.update(id, {
        logradouro: payload.logradouro || null,
        numero: payload.numero || null,
        complemento: payload.complemento || null,
        bairro: payload.bairro || null,
        quarteirao: payload.quarteirao || null,
        latitude: payload.latitude.trim() ? Number(payload.latitude) : null,
        longitude: payload.longitude.trim() ? Number(payload.longitude) : null,
        proprietario_ausente: payload.proprietario_ausente,
        tipo_ausencia: payload.tipo_ausencia || null,
        contato_proprietario: payload.contato_proprietario || null,
        tem_animal_agressivo: payload.tem_animal_agressivo,
        tem_calha: payload.tem_calha,
        calha_acessivel: payload.calha_acessivel,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['imoveis_problematicos'] });
      queryClient.invalidateQueries({ queryKey: ['imoveis'] });
      toast.success('Perfil do imóvel atualizado.');
      setEditingImovel(null);
    },
  });

  const imoveisIndex = new Map(imoveis.map((i) => [i.imovel_id, i]));
  const rows: ImovelHistoricoAcesso[] = imoveisBase.map((b) => imoveisIndex.get(b.id) ?? toHistoricoFromImovel(b));

  const filtered = rows.filter((i) => {
    // só exibe imóveis que se qualificam em ao menos um dos três critérios
    if (!(i.pct_sem_acesso > 50 || i.requer_notificacao_formal || i.prioridade_drone)) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!(`${i.logradouro} ${i.numero} ${i.bairro} ${i.quarteirao}`.toLowerCase().includes(q))) return false;
    }
    if (filtroProblematicos && !(i.requer_notificacao_formal || i.pct_sem_acesso > 50)) return false;
    if (filtroDrone === 'drone' && !i.prioridade_drone) return false;
    if (filtroDrone === 'nao_drone' && i.prioridade_drone) return false;
    if (filtroNotif && !i.requer_notificacao_formal) return false;
    return true;
  });

  const totalDrone = rows.filter((i) => i.prioridade_drone).length;
  const totalNotif = rows.filter((i) => i.requer_notificacao_formal).length;
  const totalProblematicos = rows.filter((i) => i.requer_notificacao_formal || i.pct_sem_acesso > 50).length;

  function openEdit(r: ImovelHistoricoAcesso) {
    const base = imoveisBase.find((i) => i.id === r.imovel_id);
    setEditingImovel(r);
    setEditForm({
      logradouro: base?.logradouro ?? r.logradouro ?? '',
      numero: base?.numero ?? r.numero ?? '',
      complemento: base?.complemento ?? '',
      bairro: base?.bairro ?? r.bairro ?? '',
      quarteirao: base?.quarteirao ?? r.quarteirao ?? '',
      latitude: base?.latitude != null ? String(base.latitude) : '',
      longitude: base?.longitude != null ? String(base.longitude) : '',
      proprietario_ausente: r.proprietario_ausente,
      tipo_ausencia: r.tipo_ausencia ?? '',
      contato_proprietario: '',
      tem_animal_agressivo: r.tem_animal_agressivo,
      tem_calha: r.tem_calha,
      calha_acessivel: r.calha_acessivel,
    });
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      <AdminPageHeader
        title="Imóveis Problemáticos"
        description="Imóveis com histórico de acesso crítico, recusa ou prioridade para sobrevoo de drone."
        icon={MapPin}
      />

      <TooltipProvider delayDuration={300}>
        <div className="grid grid-cols-3 gap-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <Card
                className={cn('rounded-2xl cursor-pointer transition-all select-none', filtroProblematicos ? 'ring-2 ring-rose-500 border-rose-300 bg-rose-50/60 dark:bg-rose-950/30' : 'hover:border-rose-200')}
                onClick={() => { setFiltroProblematicos(!filtroProblematicos); setFiltroNotif(false); setFiltroDrone('todos'); }}
              >
                <CardContent className="p-4 text-center relative">
                  <Info className="absolute top-2 right-2 w-3.5 h-3.5 text-muted-foreground/50" />
                  <p className="text-2xl font-black text-foreground">{totalProblematicos}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Problemáticos</p>
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-[220px] text-xs leading-relaxed">
              Imóveis com <strong>mais de 50% das visitas sem acesso</strong> ou que exigem notificação formal. Clique para filtrar.
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Card
                className={cn('rounded-2xl cursor-pointer transition-all select-none', filtroNotif ? 'ring-2 ring-amber-500 border-amber-300 bg-amber-50/60 dark:bg-amber-950/30' : 'border-amber-200 hover:border-amber-300')}
                onClick={() => { setFiltroNotif(!filtroNotif); setFiltroProblematicos(false); setFiltroDrone('todos'); }}
              >
                <CardContent className="p-4 text-center relative">
                  <Info className="absolute top-2 right-2 w-3.5 h-3.5 text-muted-foreground/50" />
                  <p className="text-2xl font-black text-amber-600">{totalNotif}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Req. notificação</p>
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-[240px] text-xs leading-relaxed">
              Imóveis com <strong>mais de 80% das visitas sem acesso</strong> ou com proprietário marcado como ausente. Requer emissão de notificação formal. Clique para filtrar.
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Card
                className={cn('rounded-2xl cursor-pointer transition-all select-none', filtroDrone === 'drone' ? 'ring-2 ring-blue-500 border-blue-300 bg-blue-50/60 dark:bg-blue-950/30' : 'border-blue-200 hover:border-blue-300')}
                onClick={() => { setFiltroDrone(filtroDrone === 'drone' ? 'todos' : 'drone'); setFiltroProblematicos(false); setFiltroNotif(false); }}
              >
                <CardContent className="p-4 text-center relative">
                  <Info className="absolute top-2 right-2 w-3.5 h-3.5 text-muted-foreground/50" />
                  <p className="text-2xl font-black text-blue-600">{totalDrone}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Prio. drone</p>
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-[240px] text-xs leading-relaxed">
              Imóveis marcados para sobrevoo de drone — definido automaticamente após <strong>3 tentativas sem acesso</strong>, ou manualmente pelo operador. Clique para filtrar.
            </TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por endereço, bairro, quarteirão..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 rounded-xl"
          />
        </div>
        <Select value={filtroDrone} onValueChange={(v) => { setFiltroDrone(v as typeof filtroDrone); setFiltroProblematicos(false); }}>
          <SelectTrigger className={cn('w-full sm:w-44 rounded-xl', filtroDrone !== 'todos' && 'ring-2 ring-blue-500 border-blue-300')}>
            <SelectValue placeholder="Drone" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="drone">Com prio. drone</SelectItem>
            <SelectItem value="nao_drone">Sem prio. drone</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant={filtroNotif ? 'default' : 'outline'}
          className={cn('rounded-xl', filtroNotif && 'bg-amber-500 hover:bg-amber-600 border-amber-500')}
          onClick={() => { setFiltroNotif(!filtroNotif); setFiltroProblematicos(false); }}
        >
          <Bell className="w-4 h-4 mr-2" />
          Req. notificação
        </Button>
        {(filtroProblematicos || filtroNotif || filtroDrone !== 'todos' || search) && (
          <Button
            variant="ghost"
            className="rounded-xl text-muted-foreground hover:text-foreground"
            onClick={() => { setSearch(''); setFiltroDrone('todos'); setFiltroNotif(false); setFiltroProblematicos(false); }}
          >
            Limpar filtros
          </Button>
        )}
      </div>

      {!clienteId ? (
        <div className="text-center py-12 text-amber-600">
          Selecione um cliente ativo para listar os imóveis.
        </div>
      ) : isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="text-center py-12 text-rose-600">
          Erro ao carregar imóveis: {error instanceof Error ? error.message : 'falha desconhecida'}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          {rows.every((i) => !(i.pct_sem_acesso > 50 || i.requer_notificacao_formal || i.prioridade_drone))
            ? 'Nenhum imóvel se qualifica como problemático, com notificação pendente ou prioridade de drone.'
            : 'Nenhum imóvel encontrado com os filtros selecionados.'}
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {filtered.map((r) => (
              <Card key={r.imovel_id} className={cn('rounded-2xl', r.requer_notificacao_formal ? 'border-rose-300' : r.pct_sem_acesso > 50 ? 'border-amber-300' : '')}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-sm">{r.logradouro}, {r.numero}</p>
                      <p className="text-xs text-muted-foreground">{r.bairro}{r.quarteirao ? ` · Q.${r.quarteirao}` : ''}</p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {r.prioridade_drone && <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-[10px]"><Plane className="w-3 h-3 mr-1" />Drone</Badge>}
                      {r.requer_notificacao_formal && <Badge variant="destructive" className="text-[10px]"><Bell className="w-3 h-3 mr-1" />Notif.</Badge>}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>{r.total_sem_acesso}/{r.total_visitas} sem acesso ({r.pct_sem_acesso}%)</span>
                    {r.ultima_tentativa && <span>Última: {format(parseISO(r.ultima_tentativa), 'dd/MM/yy', { locale: ptBR })}</span>}
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {r.tem_animal_agressivo && <span className="flex items-center gap-1 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-0.5"><Dog className="w-3 h-3" />Animal agressivo</span>}
                    {r.historico_recusa && <span className="flex items-center gap-1 text-[11px] text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-2 py-0.5"><ShieldOff className="w-3 h-3" />Recusa</span>}
                    {r.proprietario_ausente && <span className="flex items-center gap-1 text-[11px] text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-2 py-0.5"><Home className="w-3 h-3" />Proprietário ausente</span>}
                    {r.tem_calha && !r.calha_acessivel && <span className="flex items-center gap-1 text-[11px] text-purple-700 bg-purple-50 border border-purple-200 rounded-lg px-2 py-0.5"><Wrench className="w-3 h-3" />Calha inacess.</span>}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant={r.prioridade_drone ? 'default' : 'outline'}
                      className="flex-1 rounded-xl text-xs"
                      disabled={droneToggle.isPending}
                      onClick={() => droneToggle.mutate({ id: r.imovel_id, valor: !r.prioridade_drone })}
                    >
                      <Plane className="w-3 h-3 mr-1" />
                      {r.prioridade_drone ? 'Remover drone' : 'Marcar drone'}
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1 rounded-xl text-xs" onClick={() => openEdit(r)}>
                      Editar perfil
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block rounded-2xl border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Endereço</TableHead>
                  <TableHead>Bairro</TableHead>
                  <TableHead className="text-center">Tentativas</TableHead>
                  <TableHead className="text-center">% Sem acesso</TableHead>
                  <TableHead>Motivo / Flags</TableHead>
                  <TableHead>Última tentativa</TableHead>
                  <TableHead className="text-center">Drone</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.imovel_id} className={rowColor(r)}>
                    <TableCell className="font-medium">{r.logradouro}, {r.numero}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{r.bairro}{r.quarteirao ? ` Q.${r.quarteirao}` : ''}</TableCell>
                    <TableCell className="text-center tabular-nums">{r.total_sem_acesso}/{r.total_visitas}</TableCell>
                    <TableCell className="text-center">
                      <span className={cn('font-bold tabular-nums', r.pct_sem_acesso > 80 ? 'text-rose-600' : r.pct_sem_acesso > 50 ? 'text-amber-600' : 'text-foreground')}>
                        {r.pct_sem_acesso}%
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {r.tem_animal_agressivo && <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700"><Dog className="w-3 h-3 mr-1" />Animal</Badge>}
                        {r.historico_recusa && <Badge variant="outline" className="text-[10px] border-rose-300 text-rose-700"><ShieldOff className="w-3 h-3 mr-1" />Recusa</Badge>}
                        {r.proprietario_ausente && <Badge variant="outline" className="text-[10px] border-blue-300 text-blue-700"><Home className="w-3 h-3 mr-1" />Aus.</Badge>}
                        {r.tem_calha && !r.calha_acessivel && <Badge variant="outline" className="text-[10px] border-purple-300 text-purple-700"><Wrench className="w-3 h-3 mr-1" />Calha</Badge>}
                        {r.requer_notificacao_formal && <Badge variant="destructive" className="text-[10px]"><Bell className="w-3 h-3 mr-1" />Notif.</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {r.ultima_tentativa ? format(parseISO(r.ultima_tentativa), 'dd/MM/yy', { locale: ptBR }) : '—'}
                    </TableCell>
                    <TableCell className="text-center">
                      {r.prioridade_drone ? (
                        <Badge className="bg-blue-100 text-blue-700 border-blue-200"><Plane className="w-3 h-3 mr-1" />Sim</Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant={r.prioridade_drone ? 'default' : 'outline'}
                          className="rounded-lg text-xs"
                          disabled={droneToggle.isPending}
                          onClick={() => droneToggle.mutate({ id: r.imovel_id, valor: !r.prioridade_drone })}
                        >
                          <Plane className="w-3 h-3 mr-1" />
                          {r.prioridade_drone ? 'Remover' : 'Drone'}
                        </Button>
                        <Button size="sm" variant="outline" className="rounded-lg text-xs" onClick={() => openEdit(r)}>
                          Perfil
                        </Button>
                        {r.requer_notificacao_formal && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-lg text-xs border-rose-300 text-rose-700 hover:bg-rose-50"
                            disabled={gerarNotificacao.isPending}
                            onClick={() => gerarNotificacao.mutate(r)}
                          >
                            <FileText className="w-3 h-3 mr-1" />
                            Notificar
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      <Dialog open={!!editingImovel} onOpenChange={(o) => !o && setEditingImovel(null)}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Perfil do Imóvel</DialogTitle>
          </DialogHeader>
          {editingImovel && (
            <div className="space-y-4 pt-2">
              <p className="text-sm text-muted-foreground">{editingImovel.logradouro}, {editingImovel.numero} — {editingImovel.bairro}</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1 col-span-2">
                  <Label>Logradouro</Label>
                  <Input
                    value={editForm.logradouro}
                    onChange={(e) => setEditForm({ ...editForm, logradouro: e.target.value })}
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Número</Label>
                  <Input
                    value={editForm.numero}
                    onChange={(e) => setEditForm({ ...editForm, numero: e.target.value })}
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Complemento</Label>
                  <Input
                    value={editForm.complemento}
                    onChange={(e) => setEditForm({ ...editForm, complemento: e.target.value })}
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Bairro</Label>
                  <Input
                    value={editForm.bairro}
                    onChange={(e) => setEditForm({ ...editForm, bairro: e.target.value })}
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Quarteirão</Label>
                  <Input
                    value={editForm.quarteirao}
                    onChange={(e) => setEditForm({ ...editForm, quarteirao: e.target.value })}
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Latitude</Label>
                  <Input
                    value={editForm.latitude}
                    onChange={(e) => setEditForm({ ...editForm, latitude: e.target.value })}
                    className="rounded-xl"
                    placeholder="-20.123456"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Longitude</Label>
                  <Input
                    value={editForm.longitude}
                    onChange={(e) => setEditForm({ ...editForm, longitude: e.target.value })}
                    className="rounded-xl"
                    placeholder="-54.123456"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <Label>Proprietário ausente?</Label>
                <Switch checked={editForm.proprietario_ausente} onCheckedChange={(v) => setEditForm({ ...editForm, proprietario_ausente: v })} />
              </div>
              {editForm.proprietario_ausente && (
                <div className="space-y-1">
                  <Label>Tipo de ausência</Label>
                  <Select value={editForm.tipo_ausencia} onValueChange={(v) => setEditForm({ ...editForm, tipo_ausencia: v })}>
                    <SelectTrigger className="rounded-xl"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="trabalho">Trabalho</SelectItem>
                      <SelectItem value="temporada">Temporada</SelectItem>
                      <SelectItem value="abandonado">Abandonado</SelectItem>
                      <SelectItem value="outro">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="flex items-center justify-between">
                <Label>Animal agressivo?</Label>
                <Switch checked={editForm.tem_animal_agressivo} onCheckedChange={(v) => setEditForm({ ...editForm, tem_animal_agressivo: v })} />
              </div>
              <div className="flex items-center justify-between">
                <Label>Possui calha?</Label>
                <Switch checked={editForm.tem_calha} onCheckedChange={(v) => setEditForm({ ...editForm, tem_calha: v })} />
              </div>
              {editForm.tem_calha && (
                <div className="flex items-center justify-between">
                  <Label>Calha acessível?</Label>
                  <Switch checked={editForm.calha_acessivel} onCheckedChange={(v) => setEditForm({ ...editForm, calha_acessivel: v })} />
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setEditingImovel(null)}>Cancelar</Button>
                <Button
                  className="flex-1 rounded-xl"
                  disabled={perfilUpdate.isPending}
                  onClick={() => perfilUpdate.mutate({ id: editingImovel.imovel_id, payload: editForm })}
                >
                  {perfilUpdate.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
