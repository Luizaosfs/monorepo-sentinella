import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle } from 'lucide-react';
import { useHistoricoCiclosImovel } from '@/hooks/queries/useReincidenciaInteligente';

interface Props {
  imovelId: string;
}

interface VistoriaHistorico {
  id: string;
  ciclo: number;
  status: string;
  acesso_realizado: boolean | null;
  data_visita: string;
  motivo_sem_acesso: string | null;
  tipo_atividade: string | null;
  agente: { nome: string } | null;
  depositos: { tipo: string; qtd_com_focos: number; usou_larvicida: boolean }[];
}

export function ImovelHistoricoCiclos({ imovelId }: Props) {
  const { data: historico = [], isLoading } = useHistoricoCiclosImovel(imovelId) as { data: VistoriaHistorico[]; isLoading: boolean };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
      </div>
    );
  }

  const semAcessoTotal = historico.filter((v) => v.acesso_realizado === false).length;

  // Agrupar por ciclo
  const porCiclo = new Map<number, VistoriaHistorico[]>();
  for (const v of historico) {
    if (!porCiclo.has(v.ciclo)) porCiclo.set(v.ciclo, []);
    porCiclo.get(v.ciclo)!.push(v);
  }

  if (historico.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">Nenhuma vistoria registrada para este imóvel.</p>
    );
  }

  return (
    <div className="space-y-4">
      {semAcessoTotal > 0 && (
        <div className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm border ${
          semAcessoTotal >= 3
            ? 'bg-destructive/10 border-destructive/20 text-destructive'
            : 'bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-700 text-amber-700 dark:text-amber-300'
        }`}>
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>
            <strong>{semAcessoTotal}</strong> tentativa{semAcessoTotal !== 1 ? 's' : ''} sem acesso —{' '}
            notificação formal <strong>{semAcessoTotal >= 3 ? 'recomendada' : 'não recomendada'}</strong>
          </span>
        </div>
      )}

      <div className="relative border-l-2 border-border/50 ml-3 space-y-6">
        {[...porCiclo.entries()].map(([ciclo, vistorias]) => (
          <div key={ciclo} className="relative pl-6">
            <span className="absolute -left-[17px] top-1 flex h-8 w-8 items-center justify-center rounded-full bg-card border-2 border-primary text-xs font-bold text-primary">
              {ciclo}
            </span>

            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Ciclo {ciclo}
              </p>
              {vistorias.map((v) => {
                const temFoco = v.depositos?.some((d) => d.qtd_com_focos > 0);
                const agNome = (v.agente as { nome?: string } | null)?.nome ?? 'Agente';

                return (
                  <div key={v.id} className="flex items-start gap-2 rounded-xl border border-border/60 bg-muted/10 px-3 py-2.5">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 mb-1">
                        {v.acesso_realizado === false ? (
                          <Badge variant="outline" className="text-[10px] bg-destructive/10 text-destructive border-destructive/30">
                            Sem acesso
                          </Badge>
                        ) : temFoco ? (
                          <Badge variant="outline" className="text-[10px] bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-400/30">
                            Foco encontrado
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-400/30">
                            Sem foco
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {new Date(v.data_visita).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {agNome}
                        {v.motivo_sem_acesso && ` — ${v.motivo_sem_acesso}`}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
