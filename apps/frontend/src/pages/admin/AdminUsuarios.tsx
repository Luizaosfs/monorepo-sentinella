/**
 * AdminUsuarios — gerenciamento de usuários de PLATAFORMA.
 *
 * Mostra:     admin + analista_regional (cliente_id IS NULL)
 * Cria:       admin | supervisor (com cliente) | analista_regional (com agrupamento)
 * NÃO mostra: agente, notificador — esses são gerenciados pelo supervisor em /operador/usuarios
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, supabaseUrl, supabaseAnonKey } from '@/lib/supabase';
import { api } from '@/services/api';
import { useClienteAtivo } from '@/hooks/useClienteAtivo';
import { useAuth } from '@/hooks/useAuth';
import { normalizarPapelParaExibicao } from '@/lib/labels';
import { usePagination } from '@/hooks/usePagination';
import TablePagination from '@/components/TablePagination';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, Users, Plus, Pencil, Trash2, Search, ArrowLeft } from 'lucide-react';
import AdminPageHeader from '@/components/AdminPageHeader';
import MobileListCard from '@/components/admin/MobileListCard';
import ConfirmDialog from '@/components/admin/ConfirmDialog';
import { getPapelLabel } from '@/lib/labels';

// Papéis gerenciados nesta tela (plataforma)
type PapelPlataforma = 'admin' | 'supervisor' | 'analista_regional';

interface UsuarioRow {
  id: string;
  auth_id: string | null;
  nome: string;
  email: string;
  cliente_id: string | null;
  agrupamento_id?: string | null;
  created_at: string;
  cliente_nome?: string;
  papel: PapelPlataforma;
}

interface AgrupamentoOption {
  id: string;
  nome: string;
  tipo: string;
}

interface ClienteOption {
  id: string;
  nome: string;
}

const emptyForm = {
  nome: '',
  email: '',
  papel: 'admin' as PapelPlataforma,
  cliente_id: '',
  agrupamento_id: '',
  auth_id: '',
  senha: '',
};

class EmailExistsError extends Error {
  email: string;
  constructor(email: string) { super('EMAIL_EXISTS'); this.email = email; }
}

function extractErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object') {
    const e = err as Record<string, unknown>;
    const parts = [
      typeof e.message === 'string' ? e.message : '',
      typeof e.code === 'string' ? `code=${e.code}` : '',
      typeof e.details === 'string' ? `details=${e.details}` : '',
    ].filter(Boolean).join(' | ');
    if (parts) return parts;
  }
  return 'Erro desconhecido';
}

const PRIORITY: Record<string, number> = {
  admin: 5, supervisor: 4, analista_regional: 3, agente: 2, notificador: 1,
};

// Papéis que aparecem nesta lista (plataforma = sem cliente OU supervisor criado aqui)
const PAPEIS_PLATAFORMA = new Set(['admin', 'analista_regional', 'supervisor']);

const AdminUsuarios = () => {
  const { tenantStatus } = useClienteAtivo();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<UsuarioRow | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string; description: string; onConfirm: () => void;
  } | null>(null);
  const [emailExistsWarning, setEmailExistsWarning] = useState<string | null>(null);
  const [sendingRecovery, setSendingRecovery] = useState(false);
  const [senhaTemporaria, setSenhaTemporaria] = useState<{
    nome: string; email: string; senha: string;
  } | null>(null);

  const { data, isLoading: loading } = useQuery({
    queryKey: ['admin_usuarios_plataforma'],
    queryFn: async () => {
      const [usrs, clsAll, papeis] = await Promise.all([
        api.usuarios.listAll(),
        api.clientes.listAll(),
        api.usuarios.listAllPapeis(),
      ]);

      // Mapeia papel mais prioritário por auth_id
      const papelMap = new Map<string, string>();
      for (const p of (papeis ?? [])) {
        const current = papelMap.get(p.usuario_id);
        const curPri = current ? (PRIORITY[current] ?? 0) : 0;
        const newPri = PRIORITY[p.papel] ?? 0;
        if (newPri > curPri) papelMap.set(p.usuario_id, p.papel);
      }

      // Filtra: exibe apenas admin, analista_regional e supervisor
      const rows = (usrs ?? [])
        .map((u) => {
          const papel = normalizarPapelParaExibicao(
            papelMap.get(u.auth_id ?? '') ?? 'agente'
          ) as PapelPlataforma;
          return {
            id: u.id,
            auth_id: u.auth_id,
            nome: u.nome,
            email: u.email,
            cliente_id: u.cliente_id,
            agrupamento_id: (u as UsuarioRow).agrupamento_id ?? null,
            created_at: u.created_at,
            cliente_nome: (u as UsuarioRow & { cliente?: { nome: string } }).cliente?.nome,
            papel,
          } as UsuarioRow;
        })
        .filter((u) => PAPEIS_PLATAFORMA.has(u.papel));

      return { usuarios: rows, clientes: clsAll as ClienteOption[] };
    },
    staleTime: 0,
  });

  const usuarios = data?.usuarios ?? [];
  const clientes = data?.clientes ?? [];

  const { data: agrupamentos = [] } = useQuery<AgrupamentoOption[]>({
    queryKey: ['agrupamentos_list'],
    queryFn: () => api.agrupamentos.list() as Promise<AgrupamentoOption[]>,
    staleTime: 5 * 60 * 1000,
  });

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm });
    setEmailExistsWarning(null);
    setShowForm(true);
  };

  const openEdit = (u: UsuarioRow) => {
    setEditing(u);
    setForm({
      nome: u.nome,
      email: u.email,
      papel: u.papel,
      cliente_id: u.cliente_id || '',
      agrupamento_id: u.agrupamento_id || '',
      auth_id: u.auth_id || '',
      senha: '',
    });
    setShowForm(true);
  };

  const saveMutation = useMutation({
    mutationFn: async ({ formData, editingUser }: { formData: typeof emptyForm; editingUser: UsuarioRow | null }) => {
      const emailNormalizado = formData.email.trim().toLowerCase();

      if (editingUser) {
        const isAnalista = formData.papel === 'analista_regional';
        await api.usuarios.update(editingUser.id, {
          nome: formData.nome.trim(),
          email: emailNormalizado,
          cliente_id: isAnalista || formData.papel === 'admin' ? null : (formData.cliente_id || null),
          agrupamento_id: isAnalista ? (formData.agrupamento_id || null) : null,
          ...(formData.auth_id.trim() ? { auth_id: formData.auth_id.trim() } : {}),
        });
        const authId = formData.auth_id.trim() || editingUser.auth_id;
        if (authId) await api.usuarios.setPapel(authId, formData.papel);
        return { isNew: false };
      }

      // Criação via Edge Function (service_role no backend)
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Sessão expirada. Faça login novamente.');

      const isAnalista = formData.papel === 'analista_regional';
      const resp = await fetch(`${supabaseUrl}/functions/v1/criar-usuario`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          nome: formData.nome.trim(),
          email: emailNormalizado,
          senha: formData.senha,
          papel: formData.papel,
          cliente_id: isAnalista || formData.papel === 'admin' ? null : (formData.cliente_id || null),
          agrupamento_id: isAnalista ? (formData.agrupamento_id || null) : null,
        }),
      });
      const fnData = await resp.json() as Record<string, unknown>;

      if (fnData?.error === 'EMAIL_EXISTS') throw new EmailExistsError(emailNormalizado);
      if (!resp.ok) throw new Error(String(fnData?.error ?? `Erro ${resp.status}`));

      return {
        isNew: true,
        credenciais: { nome: formData.nome.trim(), email: emailNormalizado, senha: formData.senha },
      };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['admin_usuarios_plataforma'] });
      setShowForm(false);
      if (result.isNew && result.credenciais) setSenhaTemporaria(result.credenciais);
      toast.success(result.isNew ? 'Usuário criado com sucesso' : 'Usuário atualizado');
    },
    onError: (err: unknown) => {
      if (err instanceof EmailExistsError) { setEmailExistsWarning(err.email); return; }
      toast.error(extractErrorMessage(err));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (u: UsuarioRow) => {
      if (u.auth_id) await api.usuarios.deletePapeis(u.auth_id);
      await api.usuarios.remove(u.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_usuarios_plataforma'] });
      toast.success('Usuário removido');
    },
    onError: (err: unknown) => toast.error(err instanceof Error ? err.message : 'Erro ao remover'),
  });

  const handleSave = () => {
    if (!form.nome.trim() || !form.email.trim()) {
      toast.error('Nome e email são obrigatórios'); return;
    }
    if (form.papel === 'analista_regional' && !form.agrupamento_id) {
      toast.error('Agrupamento regional é obrigatório'); return;
    }
    if (form.papel === 'supervisor' && !form.cliente_id) {
      toast.error('Cliente é obrigatório para supervisor'); return;
    }
    if (!editing) {
      if (!form.senha || form.senha.length < 8) { toast.error('Senha: mínimo 8 caracteres'); return; }
      if (!/[A-Z]/.test(form.senha)) { toast.error('Senha: pelo menos uma maiúscula'); return; }
      if (!/[0-9]/.test(form.senha)) { toast.error('Senha: pelo menos um número'); return; }
      if (!/[^A-Za-z0-9]/.test(form.senha)) { toast.error('Senha: pelo menos um caractere especial'); return; }
    }
    saveMutation.mutate({ formData: form, editingUser: editing });
  };

  const filtered = usuarios.filter((u) =>
    u.nome.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const { page, totalPages, paginated, goTo, next, prev, reset, total } = usePagination(filtered);

  // ── Formulário ────────────────────────────────────────────────────────────
  if (showForm) {
    return (
      <div className="space-y-4 animate-fade-in">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setShowForm(false)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h2 className="text-lg font-semibold">{editing ? 'Editar Usuário' : 'Novo Usuário'}</h2>
            <p className="text-sm text-muted-foreground">
              {editing ? 'Atualize os dados do usuário.' : 'Provisione acesso à plataforma.'}
            </p>
          </div>
        </div>

        <Card className="rounded-sm border-2 border-cardBorder shadow-lg shadow-black/8 dark:shadow-black/20">
          <CardContent className="p-6 space-y-4">

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome *</Label>
                <Input
                  value={form.nome}
                  onChange={(e) => setForm((p) => ({ ...p, nome: e.target.value }))}
                  placeholder="Nome completo"
                  maxLength={100}
                />
              </div>
              <div className="space-y-2">
                <Label>Email *</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                  placeholder="email@exemplo.com"
                  maxLength={255}
                />
              </div>
            </div>

            {/* Função */}
            <div className="space-y-2">
              <Label>Função</Label>
              <Select
                value={form.papel}
                onValueChange={(v) => setForm((p) => ({
                  ...p,
                  papel: v as PapelPlataforma,
                  cliente_id: '',
                  agrupamento_id: '',
                }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="supervisor">Supervisor</SelectItem>
                  <SelectItem value="analista_regional">Analista Regional</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Cliente — obrigatório para supervisor */}
            {form.papel === 'supervisor' && (
              <div className="space-y-2">
                <Label>Cliente *</Label>
                <Select
                  value={form.cliente_id}
                  onValueChange={(v) => setForm((p) => ({ ...p, cliente_id: v === '__none__' ? '' : v }))}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione o cliente" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Selecione —</SelectItem>
                    {clientes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Agrupamento — obrigatório para analista_regional */}
            {form.papel === 'analista_regional' && (
              <div className="space-y-2">
                <Label>Agrupamento Regional *</Label>
                <Select
                  value={form.agrupamento_id}
                  onValueChange={(v) => setForm((p) => ({ ...p, agrupamento_id: v === '__none__' ? '' : v }))}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione o agrupamento" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Selecione —</SelectItem>
                    {agrupamentos.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.nome} ({a.tipo})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Senha — somente criação */}
            {!editing && (
              <div className="space-y-2">
                <Label>Senha *</Label>
                <Input
                  type="password"
                  value={form.senha}
                  onChange={(e) => setForm((p) => ({ ...p, senha: e.target.value }))}
                  placeholder="Mín. 8 chars, maiúscula, número e especial"
                />
                <p className="text-xs text-muted-foreground">
                  Mínimo 8 caracteres, 1 maiúscula, 1 número e 1 caractere especial (!@#$%...).
                </p>
              </div>
            )}

            {/* Aviso email duplicado */}
            {emailExistsWarning && !editing && (
              <div className="rounded-lg border-2 border-amber-500/50 bg-amber-50 dark:bg-amber-950/30 p-4 space-y-3">
                <p className="text-sm font-medium">
                  ⚠️ Já existe um login para <strong>{emailExistsWarning}</strong>.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={sendingRecovery}
                  onClick={async () => {
                    setSendingRecovery(true);
                    try {
                      const { error } = await supabase.auth.resetPasswordForEmail(emailExistsWarning, {
                        redirectTo: `${window.location.origin}/reset-password`,
                      });
                      if (error) throw error;
                      toast.success(`Email de recuperação enviado para ${emailExistsWarning}`);
                      setEmailExistsWarning(null);
                    } catch (err: unknown) {
                      toast.error(err instanceof Error ? err.message : 'Erro ao enviar email');
                    } finally {
                      setSendingRecovery(false);
                    }
                  }}
                >
                  {sendingRecovery && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Enviar email de recuperação
                </Button>
              </div>
            )}

            {/* Redefinir senha — edição */}
            {editing && (
              <div className="space-y-2">
                <Label>Redefinir Senha</Label>
                <Button
                  type="button"
                  variant="outline"
                  onClick={async () => {
                    try {
                      const { error } = await supabase.auth.resetPasswordForEmail(editing.email, {
                        redirectTo: `${window.location.origin}/reset-password`,
                      });
                      if (error) throw error;
                      toast.success(`Link de redefinição enviado para ${editing.email}`);
                    } catch (err: unknown) {
                      toast.error(err instanceof Error ? err.message : 'Erro ao enviar email');
                    }
                  }}
                >
                  Enviar link de redefinição
                </Button>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button
                onClick={handleSave}
                disabled={saveMutation.isPending || !!tenantStatus?.isBlocked}
              >
                {saveMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {editing ? 'Salvar' : 'Criar'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Lista ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <ConfirmDialog
        open={!!confirmDialog}
        onOpenChange={(open) => { if (!open) setConfirmDialog(null); }}
        title={confirmDialog?.title ?? ''}
        description={confirmDialog?.description ?? ''}
        onConfirm={() => { confirmDialog?.onConfirm(); setConfirmDialog(null); }}
      />

      <AdminPageHeader
        title="Usuários da Plataforma"
        description="Admin, supervisores e analistas regionais. Agentes e notificadores são gerenciados pelo supervisor do cliente."
        icon={Users}
      />

      {senhaTemporaria && (
        <div className="rounded-md border border-green-300 bg-green-50 dark:bg-green-950/30 dark:border-green-800 p-4 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-green-800 dark:text-green-300">
              Usuário criado — anote as credenciais antes de fechar
            </p>
            <button
              onClick={() => setSenhaTemporaria(null)}
              className="text-green-700 dark:text-green-400 hover:opacity-70 text-xs underline"
            >
              Fechar
            </button>
          </div>
          <div className="text-sm text-green-900 dark:text-green-200 space-y-1">
            <p><span className="font-medium">Nome:</span> {senhaTemporaria.nome}</p>
            <p><span className="font-medium">E-mail:</span> {senhaTemporaria.email}</p>
            <p className="flex items-center gap-2">
              <span className="font-medium">Senha:</span>
              <code className="bg-green-100 dark:bg-green-900 px-2 py-0.5 rounded font-mono">
                {senhaTemporaria.senha}
              </code>
              <button
                onClick={() => { navigator.clipboard.writeText(senhaTemporaria!.senha); toast.success('Senha copiada'); }}
                className="text-xs underline text-green-700 dark:text-green-400 hover:opacity-70"
              >
                copiar
              </button>
            </p>
          </div>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou email..."
              className="pl-9"
              value={search}
              onChange={(e) => { setSearch(e.target.value); reset(); }}
            />
          </div>
          <Button onClick={openCreate} className="w-full sm:w-auto gap-2">
            <Plus className="w-4 h-4" /> Novo Usuário
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
                {/* Mobile */}
                <div className="md:hidden p-3 space-y-3">
                  {paginated.map((u) => (
                    <MobileListCard
                      key={u.id}
                      title={u.nome}
                      badges={
                        <Badge variant={u.papel === 'admin' ? 'default' : 'secondary'}>
                          {getPapelLabel(u.papel, true)}
                        </Badge>
                      }
                      fields={[
                        { label: 'Email', value: u.email },
                        {
                          label: u.papel === 'analista_regional' ? 'Agrupamento' : 'Cliente',
                          value: u.papel === 'analista_regional' ? 'Regional' : (u.cliente_nome ?? '—'),
                        },
                      ]}
                      onEdit={() => openEdit(u)}
                      onDelete={() => handleDelete(u)}
                    />
                  ))}
                  {filtered.length === 0 && (
                    <p className="text-center py-12 text-muted-foreground text-sm">
                      Nenhum usuário encontrado
                    </p>
                  )}
                </div>

                {/* Desktop */}
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Cliente / Escopo</TableHead>
                        <TableHead>Função</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginated.map((u) => (
                        <TableRow
                          key={u.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => openEdit(u)}
                        >
                          <TableCell className="font-medium">
                            {u.nome}
                            <span className="block text-xs text-muted-foreground font-mono">
                              {u.id.slice(0, 8)}…
                            </span>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">{u.email}</TableCell>
                          <TableCell className="text-sm">
                            {u.papel === 'analista_regional'
                              ? <span className="text-muted-foreground italic">Regional</span>
                              : u.papel === 'admin'
                              ? <span className="text-muted-foreground italic">Plataforma</span>
                              : (u.cliente_nome ?? '—')}
                          </TableCell>
                          <TableCell>
                            <Badge variant={u.papel === 'admin' ? 'default' : 'secondary'}>
                              {getPapelLabel(u.papel, true)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-1 justify-end">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => { e.stopPropagation(); openEdit(u); }}
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => { e.stopPropagation(); handleDelete(u); }}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {filtered.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                            Nenhum usuário encontrado
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
            <TablePagination
              page={page}
              totalPages={totalPages}
              total={total}
              onGoTo={goTo}
              onNext={next}
              onPrev={prev}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminUsuarios;
