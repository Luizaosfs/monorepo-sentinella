import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, History, ChevronDown, ChevronUp, FileDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { exportAuditPdf } from '@/lib/slaAuditPdf';

interface AuditEntry {
  id: string;
  cliente_id: string;
  changed_by: string | null;
  changed_at: string;
  action: string;
  config_before: Record<string, unknown> | null;
  config_after: Record<string, unknown> | null;
  usuario?: { nome: string; email: string } | null;
}

interface Props {
  clienteId: string | null;
  clienteNome?: string;
}

export default function SlaAuditLog({ clienteId, clienteNome }: Props) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchAudit = useCallback(async () => {
    if (!clienteId) { setLoading(false); return; }
    setLoading(true);
    try {
      const data = await api.slaConfigAudit.listByCliente(clienteId);
      setEntries((data as AuditEntry[]) || []);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [clienteId]);

  useEffect(() => { fetchAudit(); }, [fetchAudit]);

  if (!clienteId) {
    return (
      <div className="text-center py-10 text-muted-foreground text-sm">
        Selecione um cliente para ver o histórico.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-10 text-muted-foreground text-sm">
        Nenhuma alteração registrada para este cliente.
      </div>
    );
  }

  return (
    <div className="space-y-3 animate-fade-in">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="text-sm font-semibold">Histórico de Alterações</h3>
          <p className="text-xs text-muted-foreground">Últimas 50 alterações na configuração de SLA.</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs"
          onClick={() => exportAuditPdf(entries, clienteNome)}
        >
          <FileDown className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Exportar PDF</span>
        </Button>
      </div>

      {entries.map(entry => {
        const isExpanded = expandedId === entry.id;
        const actionLabel = entry.action === 'INSERT' ? 'Criação' : entry.action === 'UPDATE' ? 'Alteração' : entry.action;
        const actionColor = entry.action === 'INSERT'
          ? 'bg-success/15 text-success'
          : entry.action === 'UPDATE'
            ? 'bg-info/15 text-info'
            : 'bg-destructive/15 text-destructive';

        return (
          <Card key={entry.id} className="card-premium overflow-hidden">
            <button
              type="button"
              className="w-full text-left"
              onClick={() => setExpandedId(isExpanded ? null : entry.id)}
            >
              <CardHeader className="p-4 pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <History className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge className={cn('text-[10px] font-bold border-0', actionColor)}>
                          {actionLabel}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(entry.changed_at).toLocaleString('pt-BR', {
                            day: '2-digit', month: '2-digit', year: '2-digit',
                            hour: '2-digit', minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        por <strong className="text-foreground">{entry.usuario?.nome || 'Sistema'}</strong>
                        {entry.usuario?.email && (
                          <span className="ml-1 text-[10px]">({entry.usuario.email})</span>
                        )}
                      </p>
                    </div>
                  </div>
                  {isExpanded
                    ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
                    : <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  }
                </div>
              </CardHeader>
            </button>

            {isExpanded && (
              <CardContent className="p-4 pt-0 space-y-3">
                <DiffSection label="Antes" data={entry.config_before} />
                <DiffSection label="Depois" data={entry.config_after} />
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}

function DiffSection({ label, data }: { label: string; data: Record<string, unknown> | null }) {
  if (!data) return null;

  return (
    <div>
      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
      <pre className="text-[11px] bg-muted/30 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-words max-h-48 overflow-y-auto font-mono">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}
