/**
 * AgenteUsuarios — gerenciamento de usuários do CLIENTE.
 *
 * Mostra:  supervisor | agente | notificador do cliente ativo
 * Cria:    supervisor (só admin) | agente | notificador
 *          A Edge Function rejeita se supervisor tentar criar outro supervisor.
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { http } from '@sentinella/api-client';
import { api } from '@/services/api';
import { useAuth } from '@/hooks/useAuth';
import { useClienteAtivo } from '@/hooks/useClienteAtivo';
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
import { Loader2, Users, Plus, Pencil, Search, ArrowLeft } from 'lucide-react';
import AdminPageHeader from '@/components/AdminPageHeader';
import MobileListCard from '@/components/admin/MobileListCard';
import { getPapelLabel } from '@/lib/labels';

type PapelCliente = 'supervisor' | 'agente' | 'notificador';

interface UsuarioRow {
  id: string;
  auth_id: string | null;
  nome: string;
  email: string;
  cliente_id: string | null;
  created_at: string;
  papel: PapelCliente;
}

const PAPEIS_CLIENTE = new Set<string>(['supervisor', 'agente', 'notificador', 'operador']);

const PRIORITY: Record<string, number> = { supervisor: 3, agente: 2, operador: 2, notificador: 1 };

function normalizePapelCliente(p: string): PapelCliente {
  const lower = String(p).toLowerCase();
  if (lower === 'operador') return 'agente'; // legado pré-migration
  if (lower === 'supervisor') return 'supervisor';
  if (lower === 'notificador') return 'notificador';
  return 'agente';
}

const emptyForm = {
  nome: '',
  email: '',
  papel: 'agente' as PapelCliente,
  auth_id: '',
  senha: '',
};

class EmailExistsError extends Error {
  email: string;
  constructor(email: string) { super('EMAIL_EXISTS'); this.email = email; }
}

// Aceita 'operador' em PAPEIS_CLIENTE intencionalmente — compat JWT legado.
// Ver EXCEÇÃO_COMPAT no relatório de triagem do cleanup (Frente 1).
const AgenteUsuarios = () => {
  const { isAdmin } = useAuth();
  const { clienteId } = useClienteAtivo();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<UsuarioRow | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [emailExistsWarning, setEmailExistsWarning] = useState<string | null>(null);
  const [sendingRecovery, setSendingRecovery] = useState(false);
  const [senhaTemporaria, setSenhaTemporaria] = useState<{
    nome: string; email: string; senha: string;
  } | null>(null);

  const { data, isLoading: loading } = useQuery({
    queryKey: ['agente_usuarios', clienteId],
    queryFn: async () => {
      const [usrs, papeis, cliente] = await Promise.all([
        api.usuarios.listByCliente(clienteId!),
        api.usuarios.listPapeis(clienteId!),
        api.clientes.getById(clienteId!),
      ]);

      const papelMap = new Map<string, PapelCliente>();
      for (const p of (papeis ?? [])) {
        if (!PAPEIS_CLIENTE.has(p.papel)) continue;
        const current = papelMap.get(p.usuario_id);
        const curPri = current ? (PRIORITY[current] ?? 0) : 0;
        const newPri = PRIORITY[p.papel] ?? 0;
        if (newPri > curPri) papelMap.set(p.usuario_id, normalizePapelCliente(p.papel));
      }

      const rows = (usrs ?? [])
        .map((u) => ({
          id: u.id,
          auth_id: u.auth_id,
          nome: u.nome,
          email: u.email,
          cliente_id: u.cliente_id,
          created_at: u.created_at,
          papel: papelMap.get(u.auth_id ?? '') ?? 'agente',
        } as UsuarioRow))
        .filter((u) => PAPEIS_CLIENTE.has(u.papel));

      return { usuarios: rows, clienteNome: cliente?.nome ?? '' };
    },
    enabled: !!clienteId,
    staleTime: 0,
  });

  const usuarios = data?.usuarios ?? [];
  const clienteNome = data?.clienteNome ?? '';

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm });
    setEmailExistsWarning(null);
    setShowForm(true);
  };

  const openEdit = (u: UsuarioRow) => {
    setEditing(u);
    setForm({ nome: u.nome, email: u.email, papel: u.papel, auth_id: u.auth_id || '', senha: '' });
    setShowForm(true);
  };

  const saveMutation = useMutation({
    mutationFn: async ({ formData, editingUser }: { formData: typeof emptyForm; editingUser: UsuarioRow | null }) => {
      if (!clienteId) throw new Error('Cliente não definido');
      const emailNormalizado = formData.email.trim().toLowerCase();

      if (editingUser) {
        await api.usuarios.update(editingUser.id, {
          nome: formData.nome.trim(),
          email: emailNormalizado,
          cliente_id: clienteId,
          ...(formData.auth_id.trim() ? { auth_id: formData.auth_id.trim() } : {}),
        });
        const authId = formData.auth_id.trim() || editingUser.auth_id;
        if (authId) await api.usuarios.setPapel(authId, formData.papel);
        return { isNew: false };
      }

      // Criação via NestJS (service_role no backend)
      const fnData = await api.usuarios.insert({
        nome: formData.nome.trim(),
        email: emailNormalizado,
        senha: formData.senha,
        cliente_id: clienteId,
        papel: formData.papel,
      } as Parameters<typeof api.usuarios.insert>[0]);

      if ((fnData as { error?: string })?.error === 'EMAIL_EXISTS') throw new EmailExistsError(emailNormalizado);

      return {
        isNew: true,
        credenciais: { nome: formData.nome.trim(), email: emailNormalizado, senha: formData.senha },
      };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['agente_usuarios', clienteId] });
      setShowForm(false);
      if (result.isNew && result.credenciais) setSenhaTemporaria(result.credenciais);
      toast.success(result.isNew ? 'Usuário criado com sucesso' : 'Usuário atualizado');
    },
    onError: (err: unknown) => {
      if (err instanceof EmailExistsError) { setEmailExistsWarning(err.email); return; }
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar');
    },
  });

  const handleSave = () => {
    if (!form.nome.trim() || !form.email.trim()) {
      toast.error('Nome e email são obrigatórios'); return;
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

  const { page, totalPages, paginated, next, prev, goTo, reset, total } = usePagination(filtered);

  if (!clienteId) {
    return (
      <div className="space-y-4">
        <AdminPageHeader title="Usuários do Cliente" description="Gerencie os usuários do seu cliente." icon={Users} />
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Você não está vinculado a um cliente. Entre em contato com o administrador.
          </CardContent>
        </Card>
      </div>
    );
  }

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
              {editing ? 'Atualize os dados do usuário.' : `Provisione acesso para ${clienteNome}.`}
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Cliente — readonly */}
              <div className="space-y-2">
                <Label>Cliente</Label>
                <Input value={clienteNome} readOnly disabled className="bg-muted" />
              </div>

              {/* Função */}
              <div className="space-y-2">
                <Label>Função</Label>
                <Select
                  value={form.papel}
                  onValueChange={(v) => setForm((p) => ({ ...p, papel: v as PapelCliente }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {isAdmin && <SelectItem value="supervisor">Supervisor</SelectItem>}
                    <SelectItem value="agente">Agente</SelectItem>
                    <SelectItem value="notificador">Notificador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

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
                      await http.post('/auth/forgot-password', {
                        email: emailExistsWarning,
                        redirectTo: `${window.location.origin}/reset-password`,
                      });
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
                      await http.post('/auth/forgot-password', {
                        email: editing.email,
                        redirectTo: `${window.location.origin}/reset-password`,
                      });
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
              <Button onClick={handleSave} disabled={saveMutation.isPending}>
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
      <AdminPageHeader
        title="Usuários do Cliente"
        description={clienteNome ? `Supervisores, agentes e notificadores de ${clienteNome}.` : 'Gerencie os usuários do cliente.'}
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
                        <Badge variant={u.papel === 'supervisor' ? 'default' : 'secondary'}>
                          {getPapelLabel(u.papel, true)}
                        </Badge>
                      }
                      fields={[{ label: 'Email', value: u.email }]}
                      onEdit={() => openEdit(u)}
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
                          <TableCell className="font-medium">{u.nome}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">{u.email}</TableCell>
                          <TableCell>
                            <Badge variant={u.papel === 'supervisor' ? 'default' : 'secondary'}>
                              {getPapelLabel(u.papel, true)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => { e.stopPropagation(); openEdit(u); }}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {filtered.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
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

export default AgenteUsuarios;
