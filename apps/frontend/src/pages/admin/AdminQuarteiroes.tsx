import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Grid3x3, Plus, Trash2, Upload, Download, Search, Loader2 } from 'lucide-react';
import { useClienteAtivo } from '@/hooks/useClienteAtivo';
import { api } from '@/services/api';
import { STALE } from '@/lib/queryConfig';
import { toast } from 'sonner';
import AdminPageHeader from '@/components/AdminPageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import ConfirmDialog from '@/components/admin/ConfirmDialog';

// ── Tipos ────────────────────────────────────────────────────────────────────

interface QuarteiraoRow {
  id: string;
  codigo: string;
  bairroId?: string | null;
  bairro?: string | null;
  ativo: boolean;
}

interface RegiaoItem {
  id: string;
  nome?: string;
  regiao?: string;
}

// ── Componente ────────────────────────────────────────────────────────────────

export default function AdminQuarteiroes() {
  const { clienteId } = useClienteAtivo();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [search, setSearch] = useState('');
  const [filterBairro, setFilterBairro] = useState('__all__');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ codigo: '', bairroId: '', bairro: '' });
  const [importing, setImporting] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string; description: string; onConfirm: () => void;
  } | null>(null);

  // ── Queries ──────────────────────────────────────────────────────────────

  const { data: quarteiroes = [], isLoading: loadingQ } = useQuery({
    queryKey: ['quarteiroes_mestre', clienteId],
    queryFn: () => api.quarteiroes.listByCliente(clienteId!),
    enabled: !!clienteId,
    staleTime: STALE.MEDIUM,
  });

  const { data: regioesList = [], isLoading: loadingR } = useQuery({
    queryKey: ['regioes', clienteId],
    queryFn: () => api.regioes.listByCliente(clienteId!),
    enabled: !!clienteId,
    staleTime: STALE.LONG,
  });

  // ── Derivações ───────────────────────────────────────────────────────────

  const rows = quarteiroes as unknown as QuarteiraoRow[];
  const regioes = regioesList as unknown as RegiaoItem[];

  const regiaoNomeMap = new Map(
    regioes.map(r => [r.id, r.nome ?? r.regiao ?? ''])
  );

  const bairrosUnicos = [...new Set(
    rows.map(q => (q.bairroId ? regiaoNomeMap.get(q.bairroId) : q.bairro) ?? 'Sem bairro')
  )].sort((a, b) => a.localeCompare(b, 'pt-BR'));

  const rowsFiltrados = rows.filter(q => {
    const nome = (q.bairroId ? regiaoNomeMap.get(q.bairroId) : q.bairro) ?? 'Sem bairro';
    const matchBairro = filterBairro === '__all__' || nome === filterBairro;
    const matchSearch = !search.trim() ||
      q.codigo.toLowerCase().includes(search.toLowerCase()) ||
      nome.toLowerCase().includes(search.toLowerCase());
    return matchBairro && matchSearch;
  });

  // ── Mutations ────────────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: () =>
      api.quarteiroes.create({
        codigo: form.codigo.trim(),
        bairroId: form.bairroId || null,
        bairro:   form.bairro.trim() || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quarteiroes_mestre', clienteId] });
      setShowForm(false);
      setForm({ codigo: '', bairroId: '', bairro: '' });
      toast.success('Quarteirão cadastrado');
    },
    onError: () => toast.error('Erro ao cadastrar quarteirão'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.quarteiroes.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quarteiroes_mestre', clienteId] });
      toast.success('Quarteirão removido');
    },
    onError: () => toast.error('Erro ao remover quarteirão'),
  });

  // ── Importação JSON ──────────────────────────────────────────────────────

  const handleImportJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !clienteId) return;
    e.target.value = '';

    setImporting(true);
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const items: Record<string, unknown>[] = Array.isArray(json)
        ? json
        : json.items ?? json.dados ?? [];

      if (!Array.isArray(items) || items.length === 0)
        throw new Error('Formato inválido. Esperado array de quarteirões.');
      if (items.length > 1000)
        throw new Error('Máximo de 1000 quarteirões por importação.');

      const result = await api.quarteiroes.bulkInsert(
        items.map(r => ({
          codigo: String(r.codigo ?? r.code ?? r.quarteirao ?? ''),
          bairro: r.bairro ? String(r.bairro) : undefined,
        }))
      );

      queryClient.invalidateQueries({ queryKey: ['quarteiroes_mestre', clienteId] });
      toast.success(`Importação concluída: ${result.inserted} inseridos, ${result.updated} atualizados`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao importar JSON');
    } finally {
      setImporting(false);
    }
  };

  // ── Download de modelo ───────────────────────────────────────────────────

  const handleDownloadTemplate = () => {
    const template = regioes.length > 0
      ? regioes.slice(0, 3).flatMap((r, i) => [
          { codigo: `Q${String(i * 2 + 1).padStart(2, '0')}`, bairro: r.nome ?? r.regiao },
          { codigo: `Q${String(i * 2 + 2).padStart(2, '0')}`, bairro: r.nome ?? r.regiao },
        ])
      : [
          { codigo: 'Q01', bairro: 'Centro' },
          { codigo: 'Q02', bairro: 'Centro' },
          { codigo: 'Q03', bairro: 'Jardim Alvorada' },
        ];

    const blob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'modelo_importacao_quarteiroes.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const isLoading = loadingQ || loadingR;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 animate-fade-in pb-8">
      <AdminPageHeader
        title="Quarteirões"
        description="Cadastre e importe quarteirões vinculados aos bairros"
        icon={Grid3x3}
      />

      {/* ── Ações ── */}
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setShowForm(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Novo quarteirão
          </Button>

          <Button
            variant="outline"
            className="gap-2"
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
          >
            {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Importar JSON
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleImportJson}
          />

          <Button variant="ghost" className="gap-2 text-muted-foreground" onClick={handleDownloadTemplate}>
            <Download className="h-4 w-4" /> Baixar modelo
          </Button>
        </div>

        <Badge variant="outline" className="text-sm">
          {rows.length} quarteirão(ões) cadastrado(s)
        </Badge>
      </div>

      {/* ── Formulário inline ── */}
      {showForm && (
        <Card>
          <CardContent className="pt-5 space-y-4">
            <p className="text-sm font-medium">Novo quarteirão</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>Código *</Label>
                <Input
                  placeholder="Ex.: Q01"
                  value={form.codigo}
                  onChange={e => setForm(p => ({ ...p, codigo: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Bairro (Região)</Label>
                <Select
                  value={form.bairroId || '__none__'}
                  onValueChange={v => setForm(p => ({ ...p, bairroId: v === '__none__' ? '' : v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar bairro…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Sem bairro —</SelectItem>
                    {regioes.map(r => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.nome ?? r.regiao}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-2">
                <Button
                  onClick={() => createMutation.mutate()}
                  disabled={!form.codigo.trim() || createMutation.isPending}
                  className="gap-2"
                >
                  {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Salvar
                </Button>
                <Button variant="ghost" onClick={() => setShowForm(false)}>Cancelar</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Filtros ── */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar código ou bairro…"
            className="pl-9"
          />
        </div>
        <Select value={filterBairro} onValueChange={setFilterBairro}>
          <SelectTrigger className="w-52">
            <SelectValue placeholder="Todos os bairros" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos os bairros</SelectItem>
            {bairrosUnicos.map(b => (
              <SelectItem key={b} value={b}>{b}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ── Tabela ── */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-12 flex justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : rowsFiltrados.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground space-y-2">
              <p className="font-medium">
                {rows.length === 0
                  ? 'Nenhum quarteirão cadastrado ainda.'
                  : 'Nenhum resultado para os filtros aplicados.'}
              </p>
              {rows.length === 0 && (
                <p className="text-xs">
                  Importe um JSON ou cadastre individualmente acima.
                </p>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Bairro</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-16" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rowsFiltrados.map(q => {
                  const bairroNome = q.bairroId
                    ? (regiaoNomeMap.get(q.bairroId) ?? q.bairro ?? '—')
                    : (q.bairro ?? '—');
                  return (
                    <TableRow key={q.id}>
                      <TableCell className="font-medium">{q.codigo}</TableCell>
                      <TableCell className="text-muted-foreground">{bairroNome}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={q.ativo
                            ? 'text-emerald-700 border-emerald-200 bg-emerald-50'
                            : 'text-red-700 border-red-200 bg-red-50'}
                        >
                          {q.ativo ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive h-7 w-7"
                          onClick={() => setConfirmDialog({
                            title: 'Remover quarteirão',
                            description: `Remover o quarteirão "${q.codigo}"?`,
                            onConfirm: () => deleteMutation.mutate(q.id),
                          })}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {confirmDialog && (
        <ConfirmDialog
          title={confirmDialog.title}
          description={confirmDialog.description}
          onConfirm={() => { confirmDialog.onConfirm(); setConfirmDialog(null); }}
          onCancel={() => setConfirmDialog(null)}
        />
      )}
    </div>
  );
}
