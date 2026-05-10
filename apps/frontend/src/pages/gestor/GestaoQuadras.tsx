import { useMemo, useState } from 'react';
import {
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Edit2,
  Layers,
  Loader2,
  Map,
  MapPin,
  Plus,
  Search,
  Trash2,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

import { QuarteiraoMapEditor } from '@/components/quarteiroes/QuarteiraoMapEditor';
import { ModalDesenharQuarteirao } from '@/components/quarteiroes/ModalDesenharQuarteirao';
import type { RegiaoParaDesenho } from '@/components/quarteiroes/ModalDesenharQuarteirao';
import { useClienteAtivo } from '@/hooks/useClienteAtivo';
import { useRegioes } from '@/hooks/queries/useRegioes';
import {
  useCriarQuadra,
  useQuadrasList,
  useRemoverQuadra,
  useSalvarQuadra,
} from '@/hooks/queries/useGestaoQuadras';
import { ModalGerarLoteQuarteiroes } from '@/components/distribuicao/ModalGerarLoteQuarteiroes';
import type { BairroQuadra } from '@/types/database';

// ── Helpers ───────────────────────────────────────────────────────────────────

type RegiaoSimples = { id: string; regiao?: string; nome?: string };

function nomeRegiao(r: RegiaoSimples): string {
  return r.regiao ?? r.nome ?? r.id;
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({
  icon: Icon,
  label,
  value,
  loading,
  iconClass = 'text-primary',
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  loading?: boolean;
  iconClass?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Icon className={`w-5 h-5 ${iconClass}`} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
            {loading ? (
              <Skeleton className="h-7 w-12" />
            ) : (
              <p className="text-2xl font-bold leading-tight">{value}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Modal Nova / Editar Quadra ─────────────────────────────────────────────────

function ModalNovaQuadra({
  open,
  editando,
  regioes,
  onClose,
}: {
  open: boolean;
  editando: BairroQuadra | null;
  regioes: RegiaoSimples[];
  onClose: () => void;
}) {
  const criar = useCriarQuadra();
  const salvar = useSalvarQuadra();
  const isEdit = !!editando;

  const [codigo, setCodigo] = useState(editando?.codigo ?? '');
  const [regiaoId, setRegiaoId] = useState(editando?.bairro_id ?? '__none__');
  const [ativo, setAtivo] = useState(editando?.ativo ?? true);

  function handleSubmit() {
    const c = codigo.trim();
    if (!c) { toast.error('Código é obrigatório'); return; }

    const payload = {
      codigo: c,
      regiaoId: regiaoId === '__none__' ? null : regiaoId,
      ativo,
    };

    if (isEdit) {
      salvar.mutate(
        { id: editando!.id, ...payload },
        { onSuccess: () => { toast.success('Quadra atualizada'); onClose(); } },
      );
    } else {
      criar.mutate(payload, {
        onSuccess: () => { toast.success('Quadra criada'); onClose(); },
      });
    }
  }

  const loading = criar.isPending || salvar.isPending;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar quadra' : 'Nova quadra'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="q-codigo">Código *</Label>
            <Input
              id="q-codigo"
              placeholder="Ex: A-001"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Região / Bairro</Label>
            <Select value={regiaoId} onValueChange={setRegiaoId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma região" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— Sem região —</SelectItem>
                {regioes.map((r) => (
                  <SelectItem key={r.id} value={r.id}>{nomeRegiao(r)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2.5">
            <input
              id="q-ativo"
              type="checkbox"
              checked={ativo}
              onChange={(e) => setAtivo(e.target.checked)}
              className="w-4 h-4 accent-primary"
            />
            <Label htmlFor="q-ativo" className="cursor-pointer">Ativo</Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            {isEdit ? 'Salvar' : 'Criar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Grupo por Região ──────────────────────────────────────────────────────────

function GrupoRegiao({
  nome,
  quadras,
  onEdit,
  onEditMapa,
  onToggleAtivo,
  onRemover,
}: {
  nome: string;
  quadras: BairroQuadra[];
  onEdit: (q: BairroQuadra) => void;
  onEditMapa: (q: BairroQuadra) => void;
  onToggleAtivo: (q: BairroQuadra) => void;
  onRemover: (q: BairroQuadra) => void;
}) {
  const [aberto, setAberto] = useState(true);
  const comPoligono = quadras.filter((q) => q.geojson).length;

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        className="w-full flex items-center gap-3 px-4 py-3 bg-muted/40 hover:bg-muted/60 transition-colors text-left"
        onClick={() => setAberto(!aberto)}
      >
        {aberto
          ? <ChevronDown className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
          : <ChevronRight className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
        }
        <Building2 className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
        <span className="font-medium flex-1 text-sm">{nome}</span>
        <span className="text-xs text-muted-foreground mr-2">{quadras.length} quadra(s)</span>
        {comPoligono > 0 && (
          <Badge variant="secondary" className="text-xs font-normal">
            <MapPin className="w-3 h-3 mr-1" />{comPoligono} polígono(s)
          </Badge>
        )}
      </button>

      {aberto && (
        <div className="divide-y">
          {quadras.map((q) => (
            <div
              key={q.id}
              className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/20 transition-colors"
            >
              <span className="font-mono text-sm font-semibold w-28 truncate">{q.codigo}</span>

              <div className="flex items-center gap-1.5 flex-1">
                <Badge
                  variant={q.ativo ? 'default' : 'secondary'}
                  className="text-xs font-normal"
                >
                  {q.ativo ? 'Ativo' : 'Inativo'}
                </Badge>
                {q.geojson ? (
                  <Badge variant="outline" className="text-xs font-normal text-green-700 border-green-200">
                    <MapPin className="w-3 h-3 mr-1" />Com polígono
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs font-normal text-muted-foreground">
                    Sem polígono
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-0.5">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  title="Editar área (polígono)"
                  onClick={() => onEditMapa(q)}
                >
                  <Map className="w-3.5 h-3.5 text-muted-foreground" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  title="Editar"
                  onClick={() => onEdit(q)}
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  title={q.ativo ? 'Desativar' : 'Ativar'}
                  onClick={() => onToggleAtivo(q)}
                >
                  {q.ativo
                    ? <XCircle className="w-3.5 h-3.5 text-muted-foreground" />
                    : <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                  }
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive hover:text-destructive"
                  title="Excluir"
                  onClick={() => onRemover(q)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function GestaoQuadras() {
  const { clienteId } = useClienteAtivo();

  const { data: quadrasRaw = [], isLoading } = useQuadrasList(clienteId);
  const { data: regioesRaw = [] } = useRegioes(clienteId);
  const quadras = quadrasRaw as BairroQuadra[];
  const regioes = (regioesRaw as RegiaoSimples[]).filter((r) => r?.id);

  const salvar  = useSalvarQuadra();
  const remover = useRemoverQuadra();

  const [busca, setBusca]               = useState('');
  const [filtroRegiao, setFiltroRegiao] = useState('__all__');
  const [filtroAtivo, setFiltroAtivo]   = useState('todos');
  const [filtroPoligono, setFiltroPoligono] = useState('todos');
  const [modalNova, setModalNova]           = useState(false);
  const [modalLote, setModalLote]           = useState(false);
  const [modalDesenhar, setModalDesenhar]   = useState(false);
  const [editando, setEditando]             = useState<BairroQuadra | null>(null);
  const [editandoMapa, setEditandoMapa]     = useState<BairroQuadra | null>(null);

  // KPIs — da lista completa
  const total      = quadras.length;
  const ativas     = quadras.filter((q) => q.ativo).length;
  const comPoligono = quadras.filter((q) => q.geojson).length;
  const semPoligono = total - comPoligono;

  // Filtros client-side
  const filtradas = useMemo(() => {
    return quadras.filter((q) => {
      if (busca && !q.codigo.toLowerCase().includes(busca.toLowerCase())) return false;
      if (filtroRegiao !== '__all__') {
        if (filtroRegiao === '__sem__')       { if (q.bairro_id) return false; }
        else if (q.bairro_id !== filtroRegiao) return false;
      }
      if (filtroAtivo === 'ativo'   && !q.ativo) return false;
      if (filtroAtivo === 'inativo' &&  q.ativo) return false;
      if (filtroPoligono === 'com'  && !q.geojson) return false;
      if (filtroPoligono === 'sem'  &&  q.geojson) return false;
      return true;
    });
  }, [quadras, busca, filtroRegiao, filtroAtivo, filtroPoligono]);

  // Agrupamento por região
  const porRegiao = useMemo(() => {
    const mapa = new Map<string | null, BairroQuadra[]>();
    for (const q of filtradas) {
      const key = q.bairro_id ?? null;
      mapa.set(key, [...(mapa.get(key) ?? []), q]);
    }
    return Array.from(mapa.entries()).sort(([a], [b]) => {
      if (a === null && b === null) return 0;
      if (a === null) return 1;
      if (b === null) return -1;
      const ra = regioes.find((r) => r.id === a);
      const rb = regioes.find((r) => r.id === b);
      return nomeRegiao(ra ?? { id: a }).localeCompare(nomeRegiao(rb ?? { id: b }));
    });
  }, [filtradas, regioes]);

  function nomeDoGrupo(regiaoId: string | null) {
    if (!regiaoId) return '(Sem região)';
    const r = regioes.find((r) => r.id === regiaoId);
    return r ? nomeRegiao(r) : regiaoId;
  }

  function handleToggleAtivo(q: BairroQuadra) {
    salvar.mutate(
      { id: q.id, ativo: !q.ativo },
      { onSuccess: () => toast.success(q.ativo ? 'Quadra desativada' : 'Quadra ativada') },
    );
  }

  function handleRemover(q: BairroQuadra) {
    if (!confirm(`Remover a quadra "${q.codigo}"? Esta ação não pode ser desfeita.`)) return;
    remover.mutate(q.id, {
      onSuccess: () => toast.success(`Quadra "${q.codigo}" removida`),
    });
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gestão de Quadras</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Cadastro e organização territorial</p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <Button variant="outline" onClick={() => setModalLote(true)}>
            <Layers className="w-4 h-4 mr-2" />Gerar em lote
          </Button>
          <Button variant="outline" onClick={() => setModalDesenhar(true)}>
            <Map className="w-4 h-4 mr-2" />Desenhar no mapa
          </Button>
          <Button onClick={() => { setEditando(null); setModalNova(true); }}>
            <Plus className="w-4 h-4 mr-2" />Nova quadra
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard icon={Building2}   label="Total de quadras"  value={total}       loading={isLoading} />
        <KpiCard icon={CheckCircle2} label="Ativas"           value={ativas}      loading={isLoading} iconClass="text-green-600" />
        <KpiCard icon={MapPin}       label="Com polígono"     value={comPoligono} loading={isLoading} iconClass="text-blue-600" />
        <KpiCard icon={Layers}       label="Sem polígono"     value={semPoligono} loading={isLoading} iconClass="text-yellow-600" />
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            className="pl-8"
            placeholder="Buscar por código..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>

        <Select value={filtroRegiao} onValueChange={setFiltroRegiao}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Todas as regiões" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todas as regiões</SelectItem>
            <SelectItem value="__sem__">(Sem região)</SelectItem>
            {regioes.map((r) => (
              <SelectItem key={r.id} value={r.id}>{nomeRegiao(r)}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filtroAtivo} onValueChange={setFiltroAtivo}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            <SelectItem value="ativo">Somente ativas</SelectItem>
            <SelectItem value="inativo">Somente inativas</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filtroPoligono} onValueChange={setFiltroPoligono}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Com e sem polígono</SelectItem>
            <SelectItem value="com">Com polígono</SelectItem>
            <SelectItem value="sem">Sem polígono</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
        </div>
      ) : filtradas.length === 0 ? (
        <div className="text-center py-14 text-muted-foreground">
          <Building2 className="w-10 h-10 mx-auto mb-3 opacity-25" />
          <p className="font-medium">Nenhuma quadra encontrada</p>
          <p className="text-sm mt-1">
            {total === 0
              ? 'Crie a primeira quadra clicando em "Nova quadra".'
              : 'Ajuste os filtros para ver outros resultados.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {porRegiao.map(([regiaoId, grupo]) => (
            <GrupoRegiao
              key={regiaoId ?? '__sem__'}
              nome={nomeDoGrupo(regiaoId)}
              quadras={grupo}
              onEdit={(q) => { setEditando(q); setModalNova(true); }}
              onEditMapa={setEditandoMapa}
              onToggleAtivo={handleToggleAtivo}
              onRemover={handleRemover}
            />
          ))}
          <p className="text-xs text-muted-foreground text-right pt-1">
            Exibindo {filtradas.length} de {total} quadra(s)
          </p>
        </div>
      )}

      {/* Modals */}
      {modalNova && (
        <ModalNovaQuadra
          key={editando?.id ?? 'new'}
          open={modalNova}
          editando={editando}
          regioes={regioes}
          onClose={() => { setModalNova(false); setEditando(null); }}
        />
      )}
      {modalLote && (
        <ModalGerarLoteQuarteiroes
          open={modalLote}
          regioes={regioes}
          onClose={() => setModalLote(false)}
        />
      )}

      {editandoMapa && (
        <QuarteiraoMapEditor
          key={editandoMapa.id}
          quarteirao={editandoMapa}
          onClose={() => setEditandoMapa(null)}
        />
      )}
      {modalDesenhar && (
        <ModalDesenharQuarteirao
          open={modalDesenhar}
          regioes={regioesRaw as RegiaoParaDesenho[]}
          onClose={() => setModalDesenhar(false)}
        />
      )}
    </div>
  );
}
