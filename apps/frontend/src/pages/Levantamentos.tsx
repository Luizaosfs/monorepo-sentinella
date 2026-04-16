import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { usePagination } from '@/hooks/usePagination';
import TablePagination from '@/components/TablePagination';
import { api } from '@/services/api';
import { LevantamentoItem } from '@/types/database';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Loader2, Search, MapPin, AlertTriangle, WifiOff, FileDown, Image as ImageIcon, Link2, ClipboardList,
  Circle, CircleDot, CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { StatusAtendimento } from '@/types/database';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import PullToRefresh from '@/components/PullToRefresh';
import { useClienteAtivo } from '@/hooks/useClienteAtivo';
import ItemDetailPanel from '@/components/levantamentos/ItemDetailPanel';
import { generateLevantamentoReport } from '@/lib/reportPdf';
import { toast } from 'sonner';
import { useLevantamentos } from '@/hooks/queries/useLevantamentos';
import { useLevantamentoItens } from '@/hooks/queries/useLevantamentoItens';
import { usePlanejamentos } from '@/hooks/queries/usePlanejamentos';
import { LevantamentoHeader } from '@/components/levantamentos/LevantamentoHeader';
import { LevantamentoList } from '@/components/levantamentos/LevantamentoList';
import { LevantamentoItemTable } from '@/components/levantamentos/LevantamentoItemTable';
import { LevantamentoMobileItem } from '@/components/levantamentos/LevantamentoMobileItem';
import { useQueryClient } from '@tanstack/react-query';
import { LevantamentoListSkeleton } from '@/components/ui/Skeletons';

const Levantamentos = () => {
  const { clienteId } = useClienteAtivo();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const levFromUrl = searchParams.get('lev') ?? searchParams.get('id');

  const { data: levantamentos = [], isLoading: loading, isError: offline, refetch: fetchLevantamentos } = useLevantamentos(clienteId);
  const { data: planejamentos = [] } = usePlanejamentos(clienteId);

  const [search, setSearch] = useState('');
  const [selectedLevId, setSelectedLevId] = useState<string | null>(null);
  const { data: itens = [], isLoading: itensLoading } = useLevantamentoItens(selectedLevId);

  const selectedLev = useMemo(() => levantamentos.find(l => l.id === selectedLevId), [levantamentos, selectedLevId]);

  useEffect(() => {
    if (!levFromUrl || levantamentos.length === 0) return;
    if (levantamentos.some((l) => l.id === levFromUrl)) setSelectedLevId(levFromUrl);
  }, [levFromUrl, levantamentos]);

  const [selectedItem, setSelectedItem] = useState<LevantamentoItem | null>(null);
  const [reportRiskFilter, setReportRiskFilter] = useState<string>('todos');
  const [filterStatus, setFilterStatus] = useState<StatusAtendimento | 'todos'>('todos');

  const filteredItens = useMemo(() => {
    if (filterStatus === 'todos') return itens;
    return itens.filter((i) => (i.status_atendimento ?? 'pendente') === filterStatus);
  }, [itens, filterStatus]);

  const itensPag = usePagination(filteredItens, 25);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfProgress, setPdfProgress] = useState('');
  const [filterPlanejamento, setFilterPlanejamento] = useState<string>('__all__');
  const [filterTipoEntrada, setFilterTipoEntrada] = useState<string>('__all__');

  const handleLinkPlanejamento = async (levId: string, planejamentoId: string | null) => {
    try {
      await api.levantamentos.updatePlanejamento(levId, planejamentoId);
      toast.success(planejamentoId ? 'Planejamento vinculado' : 'Planejamento desvinculado');
      queryClient.invalidateQueries({ queryKey: ['levantamentos', clienteId] });
    } catch (error) {
      toast.error('Erro ao vincular planejamento');
    }
  };

  const handleBackToList = () => {
    setSelectedLevId(null);
    setSelectedItem(null);
  };

  const filtered = useMemo(() => {
    return levantamentos.filter((l) => {
      const matchSearch = l.titulo.toLowerCase().includes(search.toLowerCase());
      const matchPlanejamento = filterPlanejamento === '__all__' || l.planejamento_id === filterPlanejamento;
      const matchTipo = filterTipoEntrada === '__all__' || (l.tipo_entrada || '').toUpperCase() === filterTipoEntrada;
      return matchSearch && matchPlanejamento && matchTipo;
    });
  }, [levantamentos, search, filterPlanejamento, filterTipoEntrada]);

  const { page, totalPages, paginated: paginatedLev, goTo, next, prev, reset: resetPage, total: totalLev } = usePagination(filtered);

  if (loading) {
    return (
      <div className="p-4 lg:p-6">
        <LevantamentoListSkeleton />
      </div>
    );
  }

  if (!clienteId) {
    return (
      <Card className="rounded-sm border-2 border-cardBorder shadow-md shadow-black/8 dark:shadow-black/20">
        <CardContent className="py-10 text-center text-muted-foreground">
          Seu usuário não está vinculado a um cliente.
        </CardContent>
      </Card>
    );
  }

  if (selectedLevId && selectedLev) {
    if (selectedItem) {
      const currentIdx = itens.findIndex(i => i.id === selectedItem.id);
      const hasPrev = currentIdx > 0;
      const hasNext = currentIdx < itens.length - 1;
      return (
        <div className="space-y-4 animate-fade-in">
          <ItemDetailPanel
            item={selectedItem}
            onBack={() => setSelectedItem(null)}
            onPrev={hasPrev ? () => setSelectedItem(itens[currentIdx - 1]) : undefined}
            onNext={hasNext ? () => setSelectedItem(itens[currentIdx + 1]) : undefined}
            currentIndex={currentIdx}
            totalCount={itens.length}
            onObservacaoSaved={(observacao) =>
              setSelectedItem((prev) => prev ? { ...prev, observacao_atendimento: observacao ?? undefined } : null)
            }
            onStatusChanged={(status, acaoAplicada) =>
              setSelectedItem((prev) => prev ? { ...prev, status_atendimento: status, acao_aplicada: acaoAplicada } : null)
            }
          />
        </div>
      );
    }

    return (
      <div className="flex flex-col h-[calc(100vh-6rem)] lg:h-[calc(100vh-4rem)] animate-fade-in">
        <LevantamentoHeader
          titulo={selectedLev.titulo}
          dataVoo={selectedLev.data_voo}
          onBack={handleBackToList}
        />

        <div className="flex items-center gap-2 px-1 shrink-0 mb-3">
          <Link2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <span className="text-xs text-muted-foreground shrink-0">Planejamento:</span>
          <Select
            value={selectedLev.planejamento_id || '__none__'}
            onValueChange={(v) => handleLinkPlanejamento(selectedLev.id, v === '__none__' ? null : v)}
          >
            <SelectTrigger className="h-7 text-xs flex-1 max-w-[280px]">
              <SelectValue placeholder="Nenhum" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Nenhum</SelectItem>
              {planejamentos.map((p) => (
                <SelectItem key={p.id} value={p.id} className="text-xs">{p.descricao || `Planejamento ${p.id.slice(0, 8)}`}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {itensLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="flex flex-col flex-1 min-h-0">
            <div className="flex gap-2 flex-wrap items-center justify-between shrink-0 mb-3">
              <div className="flex flex-wrap gap-1.5 items-center">
                <Badge variant="outline" className="py-1 px-3"><MapPin className="w-3 h-3 mr-1.5" />{itens.length} itens</Badge>
                <Badge variant="outline" className="py-1 px-3 border-destructive/30 text-destructive">
                  <AlertTriangle className="w-3 h-3 mr-1.5" />{itens.filter(i => ['alto', 'critico'].includes((i.risco || '').toLowerCase())).length} alto risco
                </Badge>
                {/* Chips de status */}
                {([
                  { key: 'todos'          as const, label: 'Todos',         icon: null,                                      count: itens.length },
                  { key: 'pendente'       as const, label: 'Pendentes',     icon: <Circle className="w-3 h-3" />,             count: itens.filter(i => (i.status_atendimento ?? 'pendente') === 'pendente').length },
                  { key: 'em_atendimento' as const, label: 'Em atend.',     icon: <CircleDot className="w-3 h-3" />,          count: itens.filter(i => i.status_atendimento === 'em_atendimento').length },
                  { key: 'resolvido'      as const, label: 'Resolvidos',    icon: <CheckCircle2 className="w-3 h-3" />,       count: itens.filter(i => i.status_atendimento === 'resolvido').length },
                ]).map(({ key, label, icon, count }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => { setFilterStatus(key); itensPag.reset(); }}
                    className={cn(
                      'flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all',
                      filterStatus === key
                        ? key === 'resolvido' ? 'bg-emerald-600 text-white border-emerald-600'
                          : key === 'em_atendimento' ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-foreground text-background border-transparent'
                        : 'border-border text-muted-foreground hover:border-muted-foreground/40'
                    )}
                  >
                    {icon}{label}
                    <span className={cn('ml-0.5 rounded-full px-1 text-[10px] font-bold',
                      filterStatus === key ? 'bg-white/20' : 'bg-muted'
                    )}>{count}</span>
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <Select value={reportRiskFilter} onValueChange={setReportRiskFilter}>
                  <SelectTrigger className="h-8 w-[130px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os riscos</SelectItem>
                    <SelectItem value="critico">Crítico</SelectItem>
                    <SelectItem value="alto">Alto</SelectItem>
                    <SelectItem value="medio">Médio</SelectItem>
                    <SelectItem value="baixo">Baixo</SelectItem>
                  </SelectContent>
                </Select>
                {pdfLoading ? (
                  <Button variant="outline" size="sm" className="text-xs gap-1.5" disabled>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span className="max-w-[120px] truncate">{pdfProgress || 'Gerando...'}</span>
                  </Button>
                ) : (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="text-xs gap-1.5">
                        <FileDown className="w-3.5 h-3.5" /> Exportar PDF
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={async () => {
                        setPdfLoading(true);
                        setPdfProgress('Gerando...');
                        try {
                          await generateLevantamentoReport({ levantamento: selectedLev, itens, riskFilter: reportRiskFilter, includeImages: false, onProgress: setPdfProgress });
                        } catch (e) { console.error(e); } finally { setPdfLoading(false); setPdfProgress(''); }
                      }}>
                        <FileDown className="w-3.5 h-3.5 mr-2" /> Sem imagens <span className="text-muted-foreground ml-1">(rápido)</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={async () => {
                        setPdfLoading(true);
                        setPdfProgress('Iniciando...');
                        try {
                          await generateLevantamentoReport({ levantamento: selectedLev, itens, riskFilter: reportRiskFilter, includeImages: true, onProgress: setPdfProgress });
                        } catch (e) { console.error(e); } finally { setPdfLoading(false); setPdfProgress(''); }
                      }}>
                        <ImageIcon className="w-3.5 h-3.5 mr-2" /> Com imagens <span className="text-muted-foreground ml-1">(completo)</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>

              <div className="flex-1 min-h-0 overflow-y-auto space-y-3">
              <div className="sm:hidden space-y-2">
                {itensPag.paginated.map((item) => (
                  <LevantamentoMobileItem
                    key={item.id}
                    item={item}
                    onClick={setSelectedItem}
                  />
                ))}
              </div>

                <LevantamentoItemTable
                  items={itensPag.paginated}
                  onSelectItem={setSelectedItem}
                />

              {itens.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <MapPin className="w-10 h-10 mb-3 opacity-20" />
                  <p className="text-sm">Nenhum item neste levantamento</p>
                </div>
              )}
              {itens.length > 0 && filteredItens.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <MapPin className="w-10 h-10 mb-3 opacity-20" />
                  <p className="text-sm">Nenhum item com este status</p>
                </div>
              )}
            </div>

            <div className="shrink-0">
              <TablePagination
                page={itensPag.page}
                totalPages={itensPag.totalPages}
                total={itensPag.total}
                pageSize={itensPag.pageSize}
                onGoTo={itensPag.goTo}
                onNext={itensPag.next}
                onPrev={itensPag.prev}
                onPageSizeChange={itensPag.setPageSize}
              />
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <PullToRefresh onRefresh={async () => { await fetchLevantamentos(); }}>
      <div className="space-y-4 lg:space-y-6 animate-fade-in">
        <Card className="overflow-hidden rounded-sm border border-sidebar-border bg-sidebar text-sidebar-foreground shadow-sm">
          <div className="flex items-center justify-between px-3 py-2 sm:px-4 lg:px-5 lg:py-2.5">
            <div className="min-w-0">
              <h2 className="text-xs sm:text-sm lg:text-base font-bold text-sidebar-primary truncate">Levantamentos</h2>
              <p className="text-[10px] sm:text-[11px] lg:text-xs text-sidebar-foreground/60 truncate">Visualize e gerencie todas as inspeções realizadas.</p>
            </div>
            <div className="hidden sm:flex h-8 w-8 sm:h-9 sm:w-9 lg:h-10 lg:w-10 items-center justify-center rounded-sm bg-sidebar-accent shrink-0 ml-3">
              <ClipboardList className="h-4 w-4 lg:h-5 lg:w-5 text-sidebar-primary" />
            </div>
          </div>
        </Card>

        {offline && (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-warning/10 border-2 border-warning/25 animate-fade-in">
            <WifiOff className="w-4 h-4 text-warning shrink-0" />
            <p className="text-xs text-warning-foreground font-medium">Você está offline. Exibindo dados salvos da última consulta.</p>
          </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar levantamento..."
              className="pl-9"
              value={search}
              onChange={(e) => { setSearch(e.target.value); resetPage(); }}
            />
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <Select value={filterTipoEntrada} onValueChange={setFilterTipoEntrada}>
              <SelectTrigger className="w-[120px] h-9 text-xs">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__" className="text-xs">Todos os tipos</SelectItem>
                <SelectItem value="DRONE" className="text-xs">Drone</SelectItem>
                <SelectItem value="MANUAL" className="text-xs">Manual</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterPlanejamento} onValueChange={setFilterPlanejamento}>
              <SelectTrigger className="w-[180px] sm:w-[220px] h-9 text-xs">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__" className="text-xs">Todos planejamentos</SelectItem>
                {planejamentos.map((p) => (
                  <SelectItem key={p.id} value={p.id} className="text-xs">{p.descricao || `Planejamento ${p.id.slice(0, 8)}`}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <LevantamentoList items={paginatedLev} onSelect={(lev) => setSelectedLevId(lev.id)} />

        {filtered.length === 0 && (
          <Card className="rounded-sm border-2 border-cardBorder shadow-md shadow-black/8 dark:shadow-black/20">
            <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <ClipboardList className="w-12 h-12 mb-4 opacity-20" />
              <p className="text-sm font-medium">Nenhum levantamento encontrado</p>
              {(search || filterPlanejamento !== '__all__' || filterTipoEntrada !== '__all__') && (
                <p className="text-xs mt-1">Tente alterar a busca ou os filtros</p>
              )}
            </CardContent>
          </Card>
        )}

        {filtered.length > 0 && (
          <Card className="rounded-sm border-2 border-cardBorder overflow-hidden">
            <TablePagination page={page} totalPages={totalPages} total={totalLev} onGoTo={goTo} onNext={next} onPrev={prev} />
          </Card>
        )}
      </div>
    </PullToRefresh>
  );
};

export default Levantamentos;

